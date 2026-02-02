/**
 * Whether Oracle Bot - Consensus Calculator
 * Aggregates data from multiple sources and calculates consensus
 */

import { createHash } from 'crypto';
import {
    Location,
    WeatherData,
    WeatherSource,
    ConsensusResult,
    ConsensusTolerance,
} from './types';
import { CONSENSUS_TOLERANCES, MIN_SOURCES } from './config';

export class ConsensusCalculator {
    private tolerances: ConsensusTolerance;
    private minSources: number;

    constructor(
        tolerances: ConsensusTolerance = CONSENSUS_TOLERANCES,
        minSources: number = MIN_SOURCES
    ) {
        this.tolerances = tolerances;
        this.minSources = minSources;
    }

    /**
     * Fetch from all sources and calculate consensus
     */
    async calculate(
        location: Location,
        sources: WeatherSource[]
    ): Promise<ConsensusResult> {
        // Fetch from all sources in parallel
        const fetchPromises = sources.map(async (source) => {
            try {
                const data = await source.fetch(location);
                return data;
            } catch (error) {
                console.error(`[Consensus] ${source.name} failed:`, error);
                return null;
            }
        });

        const results = await Promise.all(fetchPromises);
        const validData = results.filter((d): d is WeatherData => d !== null);

        console.log(`[Consensus] ${location.code}: Got ${validData.length}/${sources.length} responses`);

        // Check minimum sources
        if (validData.length < this.minSources) {
            return {
                success: false,
                data: null,
                sourceCount: validData.length,
                sources: validData.map(d => d.source),
                sourceHash: 0n,
            };
        }

        // Sort by source priority (lower = higher priority)
        validData.sort((a, b) => {
            const aPriority = sources.find(s => s.name === a.source)?.priority ?? 999;
            const bPriority = sources.find(s => s.name === b.source)?.priority ?? 999;
            return aPriority - bPriority;
        });

        // Check if data is within tolerance
        const discrepancies = this.checkDiscrepancies(validData);

        if (discrepancies && discrepancies.length > 0) {
            console.warn(`[Consensus] ${location.code}: Discrepancies found:`, discrepancies);

            // If discrepancies exist but we have enough sources, use median values
            if (validData.length >= this.minSources) {
                const consensusData = this.calculateMedian(location, validData);
                const sourceHash = this.generateSourceHash(validData);

                return {
                    success: true,
                    data: consensusData,
                    sourceCount: validData.length,
                    sources: validData.map(d => d.source),
                    sourceHash,
                    discrepancies,
                };
            }

            return {
                success: false,
                data: null,
                sourceCount: validData.length,
                sources: validData.map(d => d.source),
                sourceHash: 0n,
                discrepancies,
            };
        }

        // All sources agree within tolerance - use highest priority source as base
        const consensusData = this.calculateAverage(location, validData);
        const sourceHash = this.generateSourceHash(validData);

        return {
            success: true,
            data: consensusData,
            sourceCount: validData.length,
            sources: validData.map(d => d.source),
            sourceHash,
        };
    }

    /**
     * Check for discrepancies between sources
     */
    private checkDiscrepancies(data: WeatherData[]): ConsensusResult['discrepancies'] {
        const discrepancies: NonNullable<ConsensusResult['discrepancies']> = [];

        if (data.length < 2) return discrepancies;

        // Check temperature
        const temps = data.map(d => d.temperature);
        const tempDiff = Math.max(...temps) - Math.min(...temps);
        if (tempDiff > this.tolerances.temperature) {
            discrepancies.push({
                field: 'temperature',
                values: temps,
                difference: tempDiff,
            });
        }

        // Check precipitation
        const precips = data.map(d => d.precipitation);
        const precipDiff = Math.max(...precips) - Math.min(...precips);
        if (precipDiff > this.tolerances.precipitation) {
            discrepancies.push({
                field: 'precipitation',
                values: precips,
                difference: precipDiff,
            });
        }

        // Check visibility
        const visibilities = data.map(d => d.visibility);
        const visDiff = Math.max(...visibilities) - Math.min(...visibilities);
        if (visDiff > this.tolerances.visibility) {
            discrepancies.push({
                field: 'visibility',
                values: visibilities,
                difference: visDiff,
            });
        }

        // Check wind speed
        const winds = data.map(d => d.windSpeed);
        const windDiff = Math.max(...winds) - Math.min(...winds);
        if (windDiff > this.tolerances.windSpeed) {
            discrepancies.push({
                field: 'windSpeed',
                values: winds,
                difference: windDiff,
            });
        }

        return discrepancies;
    }

    /**
     * Calculate average values from all sources
     */
    private calculateAverage(location: Location, data: WeatherData[]): WeatherData {
        const n = data.length;

        return {
            locationId: location.id,
            timestamp: Math.floor(Date.now() / 1000),
            temperature: Math.round(data.reduce((sum, d) => sum + d.temperature, 0) / n),
            temperatureMax: Math.round(data.reduce((sum, d) => sum + d.temperatureMax, 0) / n),
            temperatureMin: Math.round(data.reduce((sum, d) => sum + d.temperatureMin, 0) / n),
            precipitation: Math.round(data.reduce((sum, d) => sum + d.precipitation, 0) / n),
            visibility: Math.round(data.reduce((sum, d) => sum + d.visibility, 0) / n),
            windSpeed: Math.round(data.reduce((sum, d) => sum + d.windSpeed, 0) / n),
            windGust: Math.round(data.reduce((sum, d) => sum + d.windGust, 0) / n),
            pressure: Math.round(data.reduce((sum, d) => sum + d.pressure, 0) / n),
            humidity: Math.round(data.reduce((sum, d) => sum + d.humidity, 0) / n),
            conditions: this.getModeCondition(data.map(d => d.conditions)),
            source: `consensus(${data.map(d => d.source).join(',')})`,
        };
    }

    /**
     * Calculate median values (more robust to outliers)
     */
    private calculateMedian(location: Location, data: WeatherData[]): WeatherData {
        const median = (arr: number[]) => {
            const sorted = [...arr].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
        };

        return {
            locationId: location.id,
            timestamp: Math.floor(Date.now() / 1000),
            temperature: median(data.map(d => d.temperature)),
            temperatureMax: median(data.map(d => d.temperatureMax)),
            temperatureMin: median(data.map(d => d.temperatureMin)),
            precipitation: median(data.map(d => d.precipitation)),
            visibility: median(data.map(d => d.visibility)),
            windSpeed: median(data.map(d => d.windSpeed)),
            windGust: median(data.map(d => d.windGust)),
            pressure: median(data.map(d => d.pressure)),
            humidity: median(data.map(d => d.humidity)),
            conditions: this.getModeCondition(data.map(d => d.conditions)),
            source: `median(${data.map(d => d.source).join(',')})`,
        };
    }

    /**
     * Get most common condition (mode)
     */
    private getModeCondition(conditions: number[]): number {
        const counts = new Map<number, number>();
        for (const c of conditions) {
            counts.set(c, (counts.get(c) || 0) + 1);
        }

        let mode = conditions[0];
        let maxCount = 0;
        for (const [cond, count] of counts) {
            if (count > maxCount) {
                maxCount = count;
                mode = cond;
            }
        }
        return mode;
    }

    /**
     * Generate hash of source data for verification
     */
    private generateSourceHash(data: WeatherData[]): bigint {
        const rawDataConcat = data
            .map(d => d.rawData || '')
            .sort()
            .join('|');

        const hash = createHash('sha256')
            .update(rawDataConcat)
            .digest('hex');

        // Convert first 32 bytes to bigint (256 bits)
        return BigInt('0x' + hash);
    }
}
