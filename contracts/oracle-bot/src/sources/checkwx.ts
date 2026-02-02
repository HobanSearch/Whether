/**
 * Whether Oracle Bot - CheckWX METAR Source
 * Aviation weather data from decoded METAR observations
 */

import axios from 'axios';
import { BaseWeatherSource } from './base';
import {
    Location,
    WeatherData,
    WeatherCondition,
    CheckWXResponse,
    CheckWXObservation,
    LocationType
} from '../types';
import { SOURCE_PRIORITIES } from '../config';

export class CheckWXSource extends BaseWeatherSource {
    name = 'checkwx';
    priority = SOURCE_PRIORITIES.CHECKWX;

    private apiKey: string;
    private baseUrl = 'https://api.checkwx.com/metar';

    constructor(apiKey: string) {
        super();
        this.apiKey = apiKey;
    }

    async fetch(location: Location): Promise<WeatherData | null> {
        // CheckWX only works for airports with ICAO codes
        if (location.type !== LocationType.AIRPORT || !location.icao) {
            return null;
        }

        try {
            const response = await axios.get<CheckWXResponse>(
                `${this.baseUrl}/${location.icao}/decoded`,
                {
                    headers: {
                        'X-API-Key': this.apiKey,
                    },
                    timeout: 10000,
                }
            );

            if (!response.data.data || response.data.data.length === 0) {
                console.warn(`[CheckWX] No data for ${location.icao}`);
                return null;
            }

            const obs = response.data.data[0];
            return this.parseObservation(location, obs, JSON.stringify(response.data));
        } catch (error) {
            console.error(`[CheckWX] Error fetching ${location.icao}:`, error);
            return null;
        }
    }

    private parseObservation(
        location: Location,
        obs: CheckWXObservation,
        rawData: string
    ): WeatherData {
        // Temperature
        const temp = obs.temperature?.celsius ?? 20;
        const temperature = this.celsiusTo10(temp);

        // Wind
        const windSpeed = this.knotsTo10(obs.wind?.speed_kts ?? 0);
        const windGust = this.knotsTo10(obs.wind?.gust_kts ?? obs.wind?.speed_kts ?? 0);

        // Visibility - CheckWX returns meters as string
        let visibility = 10000; // Default 10km
        if (obs.visibility?.meters) {
            const visMeters = parseInt(obs.visibility.meters, 10);
            if (!isNaN(visMeters)) {
                visibility = visMeters;
            }
        }

        // Pressure
        const pressure = Math.round(obs.barometer?.hpa ?? 1013);

        // Humidity
        const humidity = Math.round(obs.humidity?.percent ?? 50);

        // Conditions
        const conditions = this.parseMetarConditions(obs);

        // Precipitation - METAR doesn't directly report this, estimate from conditions
        const precipitation = this.estimatePrecipitation(conditions);

        return {
            locationId: location.id,
            timestamp: this.now(),
            temperature,
            temperatureMax: temperature + 20, // Estimate +2°C for daily max
            temperatureMin: temperature - 20, // Estimate -2°C for daily min
            precipitation,
            visibility,
            windSpeed,
            windGust,
            pressure,
            humidity,
            conditions,
            source: this.name,
            rawData,
        };
    }

    private parseMetarConditions(obs: CheckWXObservation): WeatherCondition {
        // Check explicit conditions first
        if (obs.conditions && obs.conditions.length > 0) {
            for (const cond of obs.conditions) {
                const code = cond.code.toUpperCase();

                // Thunderstorm
                if (code.includes('TS')) return WeatherCondition.STORM;

                // Snow
                if (code.includes('SN') || code.includes('SG') || code.includes('IC')) {
                    return WeatherCondition.SNOW;
                }

                // Rain
                if (code.includes('RA') || code.includes('DZ') || code.includes('SH')) {
                    return WeatherCondition.RAIN;
                }

                // Fog/Visibility obscurations
                if (code.includes('FG') || code.includes('BR') || code.includes('HZ')) {
                    return WeatherCondition.FOG;
                }
            }
        }

        // Check cloud cover
        if (obs.clouds && obs.clouds.length > 0) {
            const cloudCode = obs.clouds[0].code.toUpperCase();
            if (cloudCode === 'OVC' || cloudCode === 'BKN') {
                return WeatherCondition.CLOUDY;
            }
            if (cloudCode === 'SCT' || cloudCode === 'FEW') {
                return WeatherCondition.CLOUDY;
            }
        }

        // Check visibility for fog
        if (obs.visibility?.meters) {
            const visMeters = parseInt(obs.visibility.meters, 10);
            if (!isNaN(visMeters) && visMeters < 1000) {
                return WeatherCondition.FOG;
            }
        }

        return WeatherCondition.CLEAR;
    }

    private estimatePrecipitation(conditions: WeatherCondition): number {
        switch (conditions) {
            case WeatherCondition.STORM:
                return 100; // 10mm estimate
            case WeatherCondition.RAIN:
                return 30;  // 3mm estimate
            case WeatherCondition.SNOW:
                return 20;  // 2mm water equivalent
            default:
                return 0;
        }
    }
}
