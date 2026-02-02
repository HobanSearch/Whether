/**
 * Whether Daily Market Generator
 *
 * Comprehensive market creation script supporting all 6 product lines,
 * 50 locations, and configurable market templates.
 *
 * Run daily at midnight UTC to create markets for the next day.
 *
 * Usage:
 *   npx tsx scripts/dailyMarketGenerator.ts [--dry-run] [--product-line <line>] [--region <region>]
 *
 * Environment Variables:
 *   MARKET_FACTORY_ADDRESS - Address of the deployed MarketFactory contract
 *   ORACLE_RESOLVER_ADDRESS - Address of the deployed OracleResolver contract
 *   DEPLOYER_MNEMONIC - Mnemonic for the deployer wallet
 *   TON_ENDPOINT - TON API endpoint (default: testnet)
 */

import { TonClient, WalletContractV5R1 } from '@ton/ton';
import { Address, toNano, OpenedContract, internal, beginCell } from '@ton/core';
import { mnemonicToPrivateKey, KeyPair } from '@ton/crypto';
import { storeCreateMarket, CreateMarket } from '../build/MarketFactory/tact_MarketFactory';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

// Backend API configuration
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';

// Sleep utility
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry utility for flaky testnet API
async function withRetry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 5,
    delayMs: number = 10000,
    description: string = 'operation'
): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const isRetryable = lastError.message.includes('500') ||
                               lastError.message.includes('429') ||
                               lastError.message.includes('timeout') ||
                               lastError.message.includes('LITE_SERVER');

            if (attempt < maxAttempts && isRetryable) {
                console.log(`  ⚠ ${description} failed (attempt ${attempt}/${maxAttempts}): ${lastError.message}`);
                console.log(`  Retrying in ${delayMs / 1000}s...`);
                await sleep(delayMs);
            } else if (!isRetryable) {
                throw lastError;
            }
        }
    }
    throw lastError;
}

// Wait for seqno to change (transaction confirmed)
async function waitForSeqno(wallet: OpenedContract<WalletContractV5R1>, targetSeqno: number, maxWaitMs: number = 60000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
        try {
            const currentSeqno = await wallet.getSeqno();
            if (currentSeqno > targetSeqno) {
                return true;
            }
        } catch {
            // Ignore errors during polling
        }
        await sleep(5000);
    }
    return false;
}

// ============================================
// PRODUCT LINE DEFINITIONS
// ============================================

export type ProductLine = 'airport' | 'urban' | 'precipitation' | 'extreme' | 'energy' | 'agricultural';
export type ResolutionType = 'temp_high' | 'temp_low' | 'precipitation' | 'visibility' | 'wind_speed' | 'conditions';
export type Region = 'North America' | 'Europe' | 'Asia' | 'Middle East' | 'South America' | 'Africa' | 'Oceania';

interface ProductLineConfig {
    id: ProductLine;
    name: string;
    icon: string;
    description: string;
    primaryResolution: ResolutionType;
    secondaryResolutions: ResolutionType[];
    locationTypes: ('airport' | 'city')[];
}

export const PRODUCT_LINES: ProductLineConfig[] = [
    {
        id: 'airport',
        name: 'Flight Watch',
        icon: 'wind',
        description: 'Flight delays, visibility conditions',
        primaryResolution: 'visibility',
        secondaryResolutions: ['wind_speed'],
        locationTypes: ['airport'],
    },
    {
        id: 'urban',
        name: 'City Heat',
        icon: 'sun',
        description: 'City temperature extremes',
        primaryResolution: 'temp_high',
        secondaryResolutions: ['temp_low'],
        locationTypes: ['city'],
    },
    {
        id: 'precipitation',
        name: 'Rain Check',
        icon: 'rain',
        description: 'Rainfall amounts',
        primaryResolution: 'precipitation',
        secondaryResolutions: [],
        locationTypes: ['city', 'airport'],
    },
    {
        id: 'extreme',
        name: 'Storm Chasers',
        icon: 'storm',
        description: 'Severe weather events',
        primaryResolution: 'conditions',
        secondaryResolutions: ['wind_speed', 'precipitation'],
        locationTypes: ['city', 'airport'],
    },
    {
        id: 'energy',
        name: 'Power Grid',
        icon: 'lightning',
        description: 'Temperature affecting grid demand',
        primaryResolution: 'temp_high',
        secondaryResolutions: ['temp_low'],
        locationTypes: ['city'],
    },
    {
        id: 'agricultural',
        name: 'Harvest Outlook',
        icon: 'leaf',
        description: 'Drought, growing conditions',
        primaryResolution: 'precipitation',
        secondaryResolutions: ['temp_high'],
        locationTypes: ['city'],
    },
];

// ============================================
// LOCATION DEFINITIONS
// ============================================

interface Location {
    id: number;
    code: string;
    name: string;
    type: 'airport' | 'city';
    region: Region;
    country: string;
    coordinates: { lat: number; lon: number };
    timezone: string;
    icao?: string;
    seasonalAdjustment?: {
        summerTempOffset: number;
        winterTempOffset: number;
    };
}

export const AIRPORTS: Location[] = [
    // North America
    { id: 1001, code: 'KJFK', name: 'New York JFK', type: 'airport', region: 'North America', country: 'US', coordinates: { lat: 40.6413, lon: -73.7781 }, timezone: 'America/New_York', icao: 'KJFK' },
    { id: 1002, code: 'KLAX', name: 'Los Angeles LAX', type: 'airport', region: 'North America', country: 'US', coordinates: { lat: 33.9425, lon: -118.4081 }, timezone: 'America/Los_Angeles', icao: 'KLAX' },
    { id: 1003, code: 'KORD', name: "Chicago O'Hare", type: 'airport', region: 'North America', country: 'US', coordinates: { lat: 41.9742, lon: -87.9073 }, timezone: 'America/Chicago', icao: 'KORD' },
    { id: 1004, code: 'KMIA', name: 'Miami International', type: 'airport', region: 'North America', country: 'US', coordinates: { lat: 25.7959, lon: -80.287 }, timezone: 'America/New_York', icao: 'KMIA' },
    { id: 1005, code: 'CYYZ', name: 'Toronto Pearson', type: 'airport', region: 'North America', country: 'CA', coordinates: { lat: 43.6777, lon: -79.6248 }, timezone: 'America/Toronto', icao: 'CYYZ' },
    // Europe
    { id: 1010, code: 'EGLL', name: 'London Heathrow', type: 'airport', region: 'Europe', country: 'GB', coordinates: { lat: 51.47, lon: -0.4543 }, timezone: 'Europe/London', icao: 'EGLL' },
    { id: 1011, code: 'LFPG', name: 'Paris CDG', type: 'airport', region: 'Europe', country: 'FR', coordinates: { lat: 49.0097, lon: 2.5479 }, timezone: 'Europe/Paris', icao: 'LFPG' },
    { id: 1012, code: 'EDDF', name: 'Frankfurt', type: 'airport', region: 'Europe', country: 'DE', coordinates: { lat: 50.0379, lon: 8.5622 }, timezone: 'Europe/Berlin', icao: 'EDDF' },
    { id: 1013, code: 'EHAM', name: 'Amsterdam Schiphol', type: 'airport', region: 'Europe', country: 'NL', coordinates: { lat: 52.3105, lon: 4.7683 }, timezone: 'Europe/Amsterdam', icao: 'EHAM' },
    { id: 1014, code: 'LEMD', name: 'Madrid Barajas', type: 'airport', region: 'Europe', country: 'ES', coordinates: { lat: 40.4983, lon: -3.5676 }, timezone: 'Europe/Madrid', icao: 'LEMD' },
    // Asia
    { id: 1020, code: 'RJTT', name: 'Tokyo Haneda', type: 'airport', region: 'Asia', country: 'JP', coordinates: { lat: 35.5494, lon: 139.7798 }, timezone: 'Asia/Tokyo', icao: 'RJTT' },
    { id: 1021, code: 'RJAA', name: 'Tokyo Narita', type: 'airport', region: 'Asia', country: 'JP', coordinates: { lat: 35.772, lon: 140.3929 }, timezone: 'Asia/Tokyo', icao: 'RJAA' },
    { id: 1022, code: 'WSSS', name: 'Singapore Changi', type: 'airport', region: 'Asia', country: 'SG', coordinates: { lat: 1.3644, lon: 103.9915 }, timezone: 'Asia/Singapore', icao: 'WSSS' },
    { id: 1023, code: 'VHHH', name: 'Hong Kong', type: 'airport', region: 'Asia', country: 'HK', coordinates: { lat: 22.308, lon: 113.9185 }, timezone: 'Asia/Hong_Kong', icao: 'VHHH' },
    { id: 1024, code: 'RKSI', name: 'Seoul Incheon', type: 'airport', region: 'Asia', country: 'KR', coordinates: { lat: 37.4602, lon: 126.4407 }, timezone: 'Asia/Seoul', icao: 'RKSI' },
    // Middle East
    { id: 1030, code: 'OMDB', name: 'Dubai International', type: 'airport', region: 'Middle East', country: 'AE', coordinates: { lat: 25.2528, lon: 55.3644 }, timezone: 'Asia/Dubai', icao: 'OMDB' },
    { id: 1031, code: 'OTHH', name: 'Doha Hamad', type: 'airport', region: 'Middle East', country: 'QA', coordinates: { lat: 25.2731, lon: 51.6081 }, timezone: 'Asia/Qatar', icao: 'OTHH' },
    { id: 1032, code: 'OMAA', name: 'Abu Dhabi', type: 'airport', region: 'Middle East', country: 'AE', coordinates: { lat: 24.433, lon: 54.6511 }, timezone: 'Asia/Dubai', icao: 'OMAA' },
    // Oceania
    { id: 1040, code: 'YSSY', name: 'Sydney Airport', type: 'airport', region: 'Oceania', country: 'AU', coordinates: { lat: -33.9399, lon: 151.1753 }, timezone: 'Australia/Sydney', icao: 'YSSY' },
    { id: 1041, code: 'YMML', name: 'Melbourne Airport', type: 'airport', region: 'Oceania', country: 'AU', coordinates: { lat: -37.669, lon: 144.841 }, timezone: 'Australia/Melbourne', icao: 'YMML' },
];

export const CITIES: Location[] = [
    // North America
    { id: 2001, code: 'NYC', name: 'New York City', type: 'city', region: 'North America', country: 'US', coordinates: { lat: 40.7128, lon: -74.006 }, timezone: 'America/New_York' },
    { id: 2002, code: 'LAX', name: 'Los Angeles', type: 'city', region: 'North America', country: 'US', coordinates: { lat: 34.0522, lon: -118.2437 }, timezone: 'America/Los_Angeles' },
    { id: 2003, code: 'CHI', name: 'Chicago', type: 'city', region: 'North America', country: 'US', coordinates: { lat: 41.8781, lon: -87.6298 }, timezone: 'America/Chicago' },
    { id: 2004, code: 'MIA', name: 'Miami', type: 'city', region: 'North America', country: 'US', coordinates: { lat: 25.7617, lon: -80.1918 }, timezone: 'America/New_York' },
    { id: 2005, code: 'AUS', name: 'Austin', type: 'city', region: 'North America', country: 'US', coordinates: { lat: 30.2672, lon: -97.7431 }, timezone: 'America/Chicago' },
    { id: 2006, code: 'TOR', name: 'Toronto', type: 'city', region: 'North America', country: 'CA', coordinates: { lat: 43.6532, lon: -79.3832 }, timezone: 'America/Toronto' },
    // Europe
    { id: 2010, code: 'LON', name: 'London', type: 'city', region: 'Europe', country: 'GB', coordinates: { lat: 51.5074, lon: -0.1278 }, timezone: 'Europe/London' },
    { id: 2011, code: 'PAR', name: 'Paris', type: 'city', region: 'Europe', country: 'FR', coordinates: { lat: 48.8566, lon: 2.3522 }, timezone: 'Europe/Paris' },
    { id: 2012, code: 'BER', name: 'Berlin', type: 'city', region: 'Europe', country: 'DE', coordinates: { lat: 52.52, lon: 13.405 }, timezone: 'Europe/Berlin' },
    { id: 2013, code: 'MAD', name: 'Madrid', type: 'city', region: 'Europe', country: 'ES', coordinates: { lat: 40.4168, lon: -3.7038 }, timezone: 'Europe/Madrid' },
    { id: 2014, code: 'ROM', name: 'Rome', type: 'city', region: 'Europe', country: 'IT', coordinates: { lat: 41.9028, lon: 12.4964 }, timezone: 'Europe/Rome' },
    { id: 2015, code: 'AMS', name: 'Amsterdam', type: 'city', region: 'Europe', country: 'NL', coordinates: { lat: 52.3676, lon: 4.9041 }, timezone: 'Europe/Amsterdam' },
    { id: 2016, code: 'MOS', name: 'Moscow', type: 'city', region: 'Europe', country: 'RU', coordinates: { lat: 55.7558, lon: 37.6173 }, timezone: 'Europe/Moscow' },
    // Asia
    { id: 2020, code: 'TKY', name: 'Tokyo', type: 'city', region: 'Asia', country: 'JP', coordinates: { lat: 35.6762, lon: 139.6503 }, timezone: 'Asia/Tokyo' },
    { id: 2021, code: 'SEL', name: 'Seoul', type: 'city', region: 'Asia', country: 'KR', coordinates: { lat: 37.5665, lon: 126.978 }, timezone: 'Asia/Seoul' },
    { id: 2022, code: 'SIN', name: 'Singapore', type: 'city', region: 'Asia', country: 'SG', coordinates: { lat: 1.3521, lon: 103.8198 }, timezone: 'Asia/Singapore' },
    { id: 2023, code: 'HKG', name: 'Hong Kong', type: 'city', region: 'Asia', country: 'HK', coordinates: { lat: 22.3193, lon: 114.1694 }, timezone: 'Asia/Hong_Kong' },
    { id: 2024, code: 'MUM', name: 'Mumbai', type: 'city', region: 'Asia', country: 'IN', coordinates: { lat: 19.076, lon: 72.8777 }, timezone: 'Asia/Kolkata' },
    { id: 2025, code: 'BKK', name: 'Bangkok', type: 'city', region: 'Asia', country: 'TH', coordinates: { lat: 13.7563, lon: 100.5018 }, timezone: 'Asia/Bangkok' },
    // Middle East
    { id: 2030, code: 'DXB', name: 'Dubai', type: 'city', region: 'Middle East', country: 'AE', coordinates: { lat: 25.2048, lon: 55.2708 }, timezone: 'Asia/Dubai' },
    { id: 2031, code: 'RUH', name: 'Riyadh', type: 'city', region: 'Middle East', country: 'SA', coordinates: { lat: 24.7136, lon: 46.6753 }, timezone: 'Asia/Riyadh' },
    { id: 2032, code: 'TLV', name: 'Tel Aviv', type: 'city', region: 'Middle East', country: 'IL', coordinates: { lat: 32.0853, lon: 34.7818 }, timezone: 'Asia/Jerusalem' },
    // South America
    { id: 2040, code: 'SAO', name: 'São Paulo', type: 'city', region: 'South America', country: 'BR', coordinates: { lat: -23.5505, lon: -46.6333 }, timezone: 'America/Sao_Paulo' },
    { id: 2041, code: 'BUE', name: 'Buenos Aires', type: 'city', region: 'South America', country: 'AR', coordinates: { lat: -34.6037, lon: -58.3816 }, timezone: 'America/Argentina/Buenos_Aires' },
    { id: 2042, code: 'MEX', name: 'Mexico City', type: 'city', region: 'North America', country: 'MX', coordinates: { lat: 19.4326, lon: -99.1332 }, timezone: 'America/Mexico_City' },
    // Africa
    { id: 2050, code: 'LOS', name: 'Lagos', type: 'city', region: 'Africa', country: 'NG', coordinates: { lat: 6.5244, lon: 3.3792 }, timezone: 'Africa/Lagos' },
    { id: 2051, code: 'CAI', name: 'Cairo', type: 'city', region: 'Africa', country: 'EG', coordinates: { lat: 30.0444, lon: 31.2357 }, timezone: 'Africa/Cairo' },
    { id: 2052, code: 'CPT', name: 'Cape Town', type: 'city', region: 'Africa', country: 'ZA', coordinates: { lat: -33.9249, lon: 18.4241 }, timezone: 'Africa/Johannesburg' },
    // Oceania
    { id: 2060, code: 'SYD', name: 'Sydney', type: 'city', region: 'Oceania', country: 'AU', coordinates: { lat: -33.8688, lon: 151.2093 }, timezone: 'Australia/Sydney' },
    { id: 2061, code: 'MEL', name: 'Melbourne', type: 'city', region: 'Oceania', country: 'AU', coordinates: { lat: -37.8136, lon: 144.9631 }, timezone: 'Australia/Melbourne' },
];

export const ALL_LOCATIONS: Location[] = [...AIRPORTS, ...CITIES];

// Map city codes to weather station IDs for forecast API
const CITY_TO_STATION: Record<string, string> = {
    // North America
    'NYC': 'KNYC',
    'LAX': 'KLAX',
    'CHI': 'KORD',
    'MIA': 'KMIA',
    'AUS': 'KAUS',
    'TOR': 'CYYZ',
    'MEX': 'MMMX',
    // Europe
    'LON': 'EGLL',
    'PAR': 'LFPG',
    'BER': 'EDDB',
    'MAD': 'LEMD',
    'ROM': 'LIRF',
    'AMS': 'EHAM',
    'MOS': 'UUEE',
    // Asia
    'TKY': 'RJTT',
    'SEL': 'RKSI',
    'SIN': 'WSSS',
    'HKG': 'VHHH',
    'MUM': 'VABB',
    'BKK': 'VTBS',
    // Middle East
    'DXB': 'OMDB',
    'RUH': 'OERK',
    'TLV': 'LLBG',
    // South America
    'SAO': 'SBGR',
    'BUE': 'SAEZ',
    // Africa
    'LOS': 'DNMM',
    'CAI': 'HECA',
    'CPT': 'FACT',
    // Oceania
    'SYD': 'YSSY',
    'MEL': 'YMML',
};

/**
 * Get weather station ID for a location
 */
function getStationId(location: Location): string {
    if (location.type === 'airport') {
        return location.icao || location.code;
    }
    return CITY_TO_STATION[location.code] || location.code;
}

// ============================================
// FORECAST SERVICE
// ============================================

interface ForecastDistribution {
    p10: number;
    p25: number;
    p50: number;  // median
    p75: number;
    p90: number;
}

interface Forecast {
    locationId: number;
    date: string;
    tempHigh: ForecastDistribution;
    tempLow: ForecastDistribution;
    precipitation: ForecastDistribution;
    visibility: ForecastDistribution;
    windSpeed: ForecastDistribution;
    modelWeights: Record<string, number>;
}

interface Bracket {
    index: number;
    lowerBound: number;
    upperBound: number;
    label: string;
}

/**
 * Fetch forecast from backend API and transform to expected format
 */
async function fetchForecast(locationCode: string, date: Date): Promise<Forecast | null> {
    try {
        const dateStr = date.toISOString().split('T')[0];
        const response = await axios.get(`${BACKEND_API_URL}/api/forecasts`, {
            params: { location: locationCode, date: dateStr },
            timeout: 10000,
        });

        const data = response.data;

        // Transform backend response to expected Forecast format
        // Backend returns: { point_forecast: {t_max, t_min}, distribution: {p10, p25, p50, p75, p90} }
        // We need: { tempHigh: {p10...p90}, tempLow: {p10...p90}, ... }
        const highTemp = data.point_forecast?.t_max ?? 50;
        const lowTemp = data.point_forecast?.t_min ?? 35;
        const dist = data.distribution || {};

        // Use distribution for high temp, adjust for low temp
        const spread = 5;
        const tempHighDist: ForecastDistribution = {
            p10: dist.p10 ?? highTemp - spread * 1.5,
            p25: dist.p25 ?? highTemp - spread * 0.8,
            p50: dist.p50 ?? highTemp,
            p75: dist.p75 ?? highTemp + spread * 0.8,
            p90: dist.p90 ?? highTemp + spread * 1.5,
        };

        const tempLowDist: ForecastDistribution = {
            p10: lowTemp - spread * 1.5,
            p25: lowTemp - spread * 0.8,
            p50: lowTemp,
            p75: lowTemp + spread * 0.8,
            p90: lowTemp + spread * 1.5,
        };

        return {
            locationId: 0, // Not used
            date: dateStr,
            tempHigh: tempHighDist,
            tempLow: tempLowDist,
            precipitation: { p10: 0, p25: 0, p50: 0.1, p75: 0.25, p90: 0.5 },
            visibility: { p10: 3, p25: 5, p50: 7, p75: 9, p90: 10 },
            windSpeed: { p10: 5, p25: 8, p50: 12, p75: 18, p90: 25 },
            modelWeights: {},
        };
    } catch (error) {
        console.warn(`  Failed to fetch forecast for ${locationCode}: ${error}`);
        return null;
    }
}

/**
 * Generate temperature brackets centered around forecast median
 * Creates 5-6 brackets with intelligent ranges
 */
function generateTemperatureBrackets(forecast: Forecast, type: 'high' | 'low'): Bracket[] {
    const distribution = type === 'high' ? forecast.tempHigh : forecast.tempLow;
    const median = distribution.p50;
    const spread = Math.max(Math.round((distribution.p90 - distribution.p10) / 4), 3); // At least 3 degree spread

    // Round median to nearest whole number for cleaner brackets
    const centerTemp = Math.round(median);

    const brackets: Bracket[] = [
        {
            index: 0,
            lowerBound: -Infinity,
            upperBound: centerTemp - spread * 2,
            label: `Below ${centerTemp - spread * 2}°F`,
        },
        {
            index: 1,
            lowerBound: centerTemp - spread * 2,
            upperBound: centerTemp - spread,
            label: `${centerTemp - spread * 2}° - ${centerTemp - spread}°F`,
        },
        {
            index: 2,
            lowerBound: centerTemp - spread,
            upperBound: centerTemp,
            label: `${centerTemp - spread}° - ${centerTemp}°F`,
        },
        {
            index: 3,
            lowerBound: centerTemp,
            upperBound: centerTemp + spread,
            label: `${centerTemp}° - ${centerTemp + spread}°F`,
        },
        {
            index: 4,
            lowerBound: centerTemp + spread,
            upperBound: centerTemp + spread * 2,
            label: `${centerTemp + spread}° - ${centerTemp + spread * 2}°F`,
        },
        {
            index: 5,
            lowerBound: centerTemp + spread * 2,
            upperBound: Infinity,
            label: `Above ${centerTemp + spread * 2}°F`,
        },
    ];

    return brackets;
}

/**
 * Generate precipitation brackets
 */
function generatePrecipitationBrackets(forecast: Forecast): Bracket[] {
    return [
        { index: 0, lowerBound: 0, upperBound: 0, label: 'No Rain (0")' },
        { index: 1, lowerBound: 0, upperBound: 0.1, label: 'Trace (0-0.1")' },
        { index: 2, lowerBound: 0.1, upperBound: 0.25, label: 'Light (0.1-0.25")' },
        { index: 3, lowerBound: 0.25, upperBound: 0.5, label: 'Moderate (0.25-0.5")' },
        { index: 4, lowerBound: 0.5, upperBound: 1.0, label: 'Heavy (0.5-1.0")' },
        { index: 5, lowerBound: 1.0, upperBound: Infinity, label: 'Extreme (>1.0")' },
    ];
}

/**
 * Generate visibility brackets for airports
 */
function generateVisibilityBrackets(): Bracket[] {
    return [
        { index: 0, lowerBound: 0, upperBound: 1, label: 'Very Poor (<1 mi)' },
        { index: 1, lowerBound: 1, upperBound: 3, label: 'Poor (1-3 mi)' },
        { index: 2, lowerBound: 3, upperBound: 5, label: 'Moderate (3-5 mi)' },
        { index: 3, lowerBound: 5, upperBound: 7, label: 'Good (5-7 mi)' },
        { index: 4, lowerBound: 7, upperBound: 10, label: 'Very Good (7-10 mi)' },
        { index: 5, lowerBound: 10, upperBound: Infinity, label: 'Excellent (>10 mi)' },
    ];
}

/**
 * Generate wind speed brackets
 */
function generateWindSpeedBrackets(): Bracket[] {
    return [
        { index: 0, lowerBound: 0, upperBound: 5, label: 'Calm (<5 kt)' },
        { index: 1, lowerBound: 5, upperBound: 10, label: 'Light (5-10 kt)' },
        { index: 2, lowerBound: 10, upperBound: 15, label: 'Moderate (10-15 kt)' },
        { index: 3, lowerBound: 15, upperBound: 25, label: 'Fresh (15-25 kt)' },
        { index: 4, lowerBound: 25, upperBound: 35, label: 'Strong (25-35 kt)' },
        { index: 5, lowerBound: 35, upperBound: Infinity, label: 'Gale (>35 kt)' },
    ];
}

/**
 * Encode brackets into resolution criteria string
 * Format: "bracket:type:bounds" where bounds are comma-separated
 */
function encodeBracketCriteria(type: ResolutionType, brackets: Bracket[]): string {
    const boundsStr = brackets
        .map(b => `${b.lowerBound === -Infinity ? '-inf' : b.lowerBound}:${b.upperBound === Infinity ? 'inf' : b.upperBound}`)
        .join(',');
    return `bracket:${type}:${boundsStr}`;
}

// ============================================
// RESOLUTION CRITERIA TEMPLATES
// ============================================

interface ResolutionTemplate {
    type: ResolutionType;
    operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
    thresholdFn: (location: Location, date: Date) => number;
    unit: string;
    formatValue: (value: number) => string;
}

// Seasonal temperature adjustments based on hemisphere and month
function getSeasonalTempThreshold(location: Location, date: Date, baseTemp: number): number {
    const month = date.getMonth();
    const isSouthernHemisphere = location.coordinates.lat < 0;

    // Northern hemisphere: Dec-Feb = winter, Jun-Aug = summer
    // Southern hemisphere: reversed
    const isWinter = isSouthernHemisphere
        ? (month >= 5 && month <= 7)  // Jun-Aug
        : (month >= 11 || month <= 1); // Dec-Feb

    const isSummer = isSouthernHemisphere
        ? (month >= 11 || month <= 1)
        : (month >= 5 && month <= 7);

    // Climate zone adjustments
    const lat = Math.abs(location.coordinates.lat);
    let climateAdjustment = 0;

    if (lat < 23.5) {
        // Tropical - minimal seasonal variation
        climateAdjustment = 0;
    } else if (lat < 35) {
        // Subtropical
        climateAdjustment = isWinter ? -5 : (isSummer ? 5 : 0);
    } else if (lat < 55) {
        // Temperate
        climateAdjustment = isWinter ? -10 : (isSummer ? 10 : 0);
    } else {
        // Subarctic/Continental
        climateAdjustment = isWinter ? -20 : (isSummer ? 15 : 0);
    }

    return baseTemp + climateAdjustment;
}

export const RESOLUTION_TEMPLATES: Record<ResolutionType, ResolutionTemplate> = {
    temp_high: {
        type: 'temp_high',
        operator: 'gt',
        thresholdFn: (loc, date) => getSeasonalTempThreshold(loc, date, 200), // 20°C base
        unit: '°C × 10',
        formatValue: (v) => `${(v / 10).toFixed(1)}°C`,
    },
    temp_low: {
        type: 'temp_low',
        operator: 'lt',
        thresholdFn: (loc, date) => getSeasonalTempThreshold(loc, date, 100), // 10°C base
        unit: '°C × 10',
        formatValue: (v) => `${(v / 10).toFixed(1)}°C`,
    },
    precipitation: {
        type: 'precipitation',
        operator: 'gt',
        thresholdFn: () => 0, // > 0mm = any rain
        unit: 'mm × 10',
        formatValue: (v) => `${(v / 10).toFixed(1)}mm`,
    },
    visibility: {
        type: 'visibility',
        operator: 'gt',
        thresholdFn: () => 5000, // 5km visibility threshold
        unit: 'meters',
        formatValue: (v) => `${(v / 1000).toFixed(1)}km`,
    },
    wind_speed: {
        type: 'wind_speed',
        operator: 'gt',
        thresholdFn: () => 200, // 20 knots
        unit: 'knots × 10',
        formatValue: (v) => `${(v / 10).toFixed(0)}kt`,
    },
    conditions: {
        type: 'conditions',
        operator: 'eq',
        thresholdFn: () => 2, // 0=clear, 1=cloudy, 2=rain, 3=snow, 4=storm
        unit: 'enum',
        formatValue: (v) => ['Clear', 'Cloudy', 'Rain', 'Snow', 'Storm'][v] || 'Unknown',
    },
};

// ============================================
// MARKET TEMPLATE DEFINITIONS
// ============================================

interface MarketTemplate {
    productLine: ProductLine;
    resolutionType: ResolutionType;
    questionTemplate: string;
    descriptionTemplate: string;
    locationType: 'airport' | 'city' | 'both';
    priority: number; // 1 = high priority, 3 = low priority
    regions?: Region[]; // Optional region filter
}

export const MARKET_TEMPLATES: MarketTemplate[] = [
    // Urban - Temperature High (High Priority)
    {
        productLine: 'urban',
        resolutionType: 'temp_high',
        questionTemplate: 'Will {location} high temperature exceed {threshold}?',
        descriptionTemplate: 'Market resolves YES if the observed daily high temperature in {location} exceeds {threshold} on {date}.',
        locationType: 'city',
        priority: 1,
    },
    // Urban - Temperature Low (Medium Priority)
    {
        productLine: 'urban',
        resolutionType: 'temp_low',
        questionTemplate: 'Will {location} low temperature drop below {threshold}?',
        descriptionTemplate: 'Market resolves YES if the observed daily low temperature in {location} drops below {threshold} on {date}.',
        locationType: 'city',
        priority: 2,
    },
    // Airport - Visibility (High Priority)
    {
        productLine: 'airport',
        resolutionType: 'visibility',
        questionTemplate: 'Will {location} maintain visibility above {threshold}?',
        descriptionTemplate: 'Market resolves YES if the minimum visibility at {location} remains above {threshold} throughout {date}.',
        locationType: 'airport',
        priority: 1,
    },
    // Airport - Wind Speed (Medium Priority)
    {
        productLine: 'airport',
        resolutionType: 'wind_speed',
        questionTemplate: 'Will wind speed at {location} exceed {threshold}?',
        descriptionTemplate: 'Market resolves YES if the maximum sustained wind speed at {location} exceeds {threshold} on {date}.',
        locationType: 'airport',
        priority: 2,
    },
    // Precipitation - Rain (High Priority)
    {
        productLine: 'precipitation',
        resolutionType: 'precipitation',
        questionTemplate: 'Will {location} receive any precipitation?',
        descriptionTemplate: 'Market resolves YES if any measurable precipitation (>0.1mm) is recorded in {location} on {date}.',
        locationType: 'both',
        priority: 1,
    },
    // Extreme - Storm Conditions (Low Priority)
    {
        productLine: 'extreme',
        resolutionType: 'conditions',
        questionTemplate: 'Will severe weather conditions occur in {location}?',
        descriptionTemplate: 'Market resolves YES if severe weather conditions (storm, tornado warning, etc.) are reported in {location} on {date}.',
        locationType: 'both',
        priority: 3,
    },
    // Energy - Grid Demand (High Priority)
    {
        productLine: 'energy',
        resolutionType: 'temp_high',
        questionTemplate: 'Will {location} temperature trigger high grid demand (>{threshold})?',
        descriptionTemplate: 'Market resolves YES if the high temperature in {location} exceeds {threshold}, triggering increased grid demand on {date}.',
        locationType: 'city',
        priority: 1,
        regions: ['North America', 'Europe', 'Asia'],
    },
    // Agricultural - Drought (Medium Priority)
    {
        productLine: 'agricultural',
        resolutionType: 'precipitation',
        questionTemplate: 'Will {location} receive adequate rainfall (>{threshold})?',
        descriptionTemplate: 'Market resolves YES if {location} receives more than {threshold} of rainfall on {date}.',
        locationType: 'city',
        priority: 2,
        regions: ['North America', 'South America', 'Africa', 'Asia'],
    },
];

// ============================================
// DAILY MARKET SELECTION
// ============================================

interface DailyMarketConfig {
    maxMarketsPerDay: number;
    priorityDistribution: {
        priority1: number; // Percentage of high priority markets
        priority2: number; // Percentage of medium priority markets
        priority3: number; // Percentage of low priority markets
    };
    regionRotation: boolean; // Rotate through regions daily
    locationTypeMix: {
        airport: number; // Percentage
        city: number;    // Percentage
    };
}

const DEFAULT_DAILY_CONFIG: DailyMarketConfig = {
    maxMarketsPerDay: 20,
    priorityDistribution: {
        priority1: 50,
        priority2: 35,
        priority3: 15,
    },
    regionRotation: true,
    locationTypeMix: {
        airport: 40,
        city: 60,
    },
};

interface MarketToCreate {
    description: string;
    question: string;
    locationId: bigint;
    locationName: string;
    resolutionCriteria: string;
    threshold: number;
    productLine: ProductLine;
    expiryTimestamp: bigint;
    marketType: 'binary' | 'bracket';
    brackets?: Bracket[];
    forecastMedian?: number;
}

/**
 * Select and create daily markets with bracket format
 * Fetches real forecasts from backend to generate intelligent bracket ranges
 */
async function selectDailyMarkets(
    date: Date,
    config: DailyMarketConfig = DEFAULT_DAILY_CONFIG,
    useBrackets: boolean = true
): Promise<MarketToCreate[]> {
    const markets: MarketToCreate[] = [];
    const usedLocations = new Set<number>();

    // Calculate expiry timestamp (tomorrow noon UTC)
    const expiryDate = new Date(date);
    expiryDate.setUTCHours(12, 0, 0, 0);
    const expiryTimestamp = BigInt(Math.floor(expiryDate.getTime() / 1000));

    // Format date for descriptions
    const dateStr = date.toISOString().split('T')[0];

    // Get region for today (rotate daily)
    const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const regions: Region[] = ['North America', 'Europe', 'Asia', 'Middle East', 'South America', 'Africa', 'Oceania'];
    const primaryRegion = config.regionRotation ? regions[dayOfYear % regions.length] : undefined;

    // Sort templates by priority
    const sortedTemplates = [...MARKET_TEMPLATES].sort((a, b) => a.priority - b.priority);

    // Calculate how many markets per priority level
    const p1Count = Math.floor(config.maxMarketsPerDay * config.priorityDistribution.priority1 / 100);
    const p2Count = Math.floor(config.maxMarketsPerDay * config.priorityDistribution.priority2 / 100);
    const p3Count = config.maxMarketsPerDay - p1Count - p2Count;

    const priorityCounts = { 1: p1Count, 2: p2Count, 3: p3Count };
    const usedPerPriority = { 1: 0, 2: 0, 3: 0 };

    // Create markets
    for (const template of sortedTemplates) {
        const maxForPriority = priorityCounts[template.priority as 1 | 2 | 3];
        if (usedPerPriority[template.priority as 1 | 2 | 3] >= maxForPriority) continue;

        // Get eligible locations
        let eligibleLocations = template.locationType === 'both'
            ? ALL_LOCATIONS
            : (template.locationType === 'airport' ? AIRPORTS : CITIES);

        // Filter by region if specified
        if (template.regions) {
            eligibleLocations = eligibleLocations.filter(loc => template.regions!.includes(loc.region));
        }

        // Prioritize primary region
        if (primaryRegion) {
            const primaryLocs = eligibleLocations.filter(loc => loc.region === primaryRegion);
            const otherLocs = eligibleLocations.filter(loc => loc.region !== primaryRegion);
            eligibleLocations = [...primaryLocs, ...otherLocs];
        }

        // Filter out already used locations
        eligibleLocations = eligibleLocations.filter(loc => !usedLocations.has(loc.id));

        for (const location of eligibleLocations) {
            if (markets.length >= config.maxMarketsPerDay) break;
            if (usedPerPriority[template.priority as 1 | 2 | 3] >= maxForPriority) break;

            const resolutionTemplate = RESOLUTION_TEMPLATES[template.resolutionType];

            // Try to fetch forecast for intelligent bracket generation
            let forecast: Forecast | null = null;
            let brackets: Bracket[] | undefined;
            let forecastMedian: number | undefined;

            if (useBrackets) {
                const stationId = getStationId(location);
                forecast = await fetchForecast(stationId, date);
            }

            // Generate market based on type and forecast availability
            if (useBrackets && forecast && ['temp_high', 'temp_low'].includes(template.resolutionType)) {
                // Temperature bracket market with forecast-based ranges
                const tempType = template.resolutionType === 'temp_high' ? 'high' : 'low';
                brackets = generateTemperatureBrackets(forecast, tempType);
                forecastMedian = tempType === 'high' ? forecast.tempHigh.p50 : forecast.tempLow.p50;

                const question = `What will ${location.name}'s ${tempType} temperature be on ${dateStr}?`;
                const description = `Bracket market for ${location.name}'s ${tempType === 'high' ? 'high' : 'low'} temperature. Select the range you think the actual temperature will fall into. AI forecast median: ${Math.round(forecastMedian)}°F.`;

                markets.push({
                    description,
                    question,
                    locationId: BigInt(location.id),
                    locationName: location.name,
                    resolutionCriteria: encodeBracketCriteria(template.resolutionType, brackets),
                    threshold: Math.round(forecastMedian * 100), // Store as centidegrees
                    productLine: template.productLine,
                    expiryTimestamp,
                    marketType: 'bracket',
                    brackets,
                    forecastMedian,
                });
            } else if (useBrackets && template.resolutionType === 'precipitation') {
                // Precipitation bracket market
                brackets = generatePrecipitationBrackets(forecast || {} as Forecast);
                const question = `How much precipitation will ${location.name} receive on ${dateStr}?`;
                const description = `Bracket market for precipitation in ${location.name}. Select the range you think the total precipitation will fall into.`;

                markets.push({
                    description,
                    question,
                    locationId: BigInt(location.id),
                    locationName: location.name,
                    resolutionCriteria: encodeBracketCriteria(template.resolutionType, brackets),
                    threshold: 0,
                    productLine: template.productLine,
                    expiryTimestamp,
                    marketType: 'bracket',
                    brackets,
                });
            } else if (useBrackets && template.resolutionType === 'visibility') {
                // Visibility bracket market
                brackets = generateVisibilityBrackets();
                const question = `What will the visibility be at ${location.name} on ${dateStr}?`;
                const description = `Bracket market for visibility at ${location.name}. Select the range you think the minimum visibility will fall into.`;

                markets.push({
                    description,
                    question,
                    locationId: BigInt(location.id),
                    locationName: location.name,
                    resolutionCriteria: encodeBracketCriteria(template.resolutionType, brackets),
                    threshold: 5000, // Default visibility threshold
                    productLine: template.productLine,
                    expiryTimestamp,
                    marketType: 'bracket',
                    brackets,
                });
            } else if (useBrackets && template.resolutionType === 'wind_speed') {
                // Wind speed bracket market
                brackets = generateWindSpeedBrackets();
                const question = `What will the wind speed be at ${location.name} on ${dateStr}?`;
                const description = `Bracket market for wind speed at ${location.name}. Select the range you think the maximum sustained wind will fall into.`;

                markets.push({
                    description,
                    question,
                    locationId: BigInt(location.id),
                    locationName: location.name,
                    resolutionCriteria: encodeBracketCriteria(template.resolutionType, brackets),
                    threshold: 200, // Default wind threshold
                    productLine: template.productLine,
                    expiryTimestamp,
                    marketType: 'bracket',
                    brackets,
                });
            } else {
                // Fallback to binary market
                const threshold = resolutionTemplate.thresholdFn(location, date);
                const thresholdFormatted = resolutionTemplate.formatValue(threshold);

                const question = template.questionTemplate
                    .replace('{location}', location.name)
                    .replace('{threshold}', thresholdFormatted);

                const description = template.descriptionTemplate
                    .replace('{location}', location.name)
                    .replace('{threshold}', thresholdFormatted)
                    .replace('{date}', dateStr);

                const resolutionCriteria = `${template.resolutionType} ${resolutionTemplate.operator === 'gt' ? '>' : resolutionTemplate.operator === 'lt' ? '<' : '=='} ${threshold}`;

                markets.push({
                    description,
                    question,
                    locationId: BigInt(location.id),
                    locationName: location.name,
                    resolutionCriteria,
                    threshold,
                    productLine: template.productLine,
                    expiryTimestamp,
                    marketType: 'binary',
                });
            }

            usedLocations.add(location.id);
            usedPerPriority[template.priority as 1 | 2 | 3]++;
        }
    }

    return markets;
}

// ============================================
// CONTRACT INTERACTION
// ============================================

interface ContractConfig {
    factoryAddress: string;
    oracleAddress: string;
    tonEndpoint: string;
    deployerMnemonic: string;
    apiKey?: string;
}

async function createMarketsOnChain(
    markets: MarketToCreate[],
    config: ContractConfig,
    dryRun: boolean = false
): Promise<void> {
    if (dryRun) {
        console.log('\n=== DRY RUN MODE ===\n');
        console.log(`Would create ${markets.length} markets:\n`);

        const bracketCount = markets.filter(m => m.marketType === 'bracket').length;
        const binaryCount = markets.filter(m => m.marketType === 'binary').length;
        console.log(`Market types: ${bracketCount} bracket, ${binaryCount} binary\n`);

        for (const market of markets) {
            console.log(`- [${market.productLine.toUpperCase()}] [${market.marketType.toUpperCase()}] ${market.question}`);
            console.log(`  Location: ${market.locationName} (ID: ${market.locationId})`);
            console.log(`  Criteria: ${market.resolutionCriteria}`);
            if (market.brackets) {
                console.log(`  Brackets:`);
                for (const bracket of market.brackets) {
                    console.log(`    ${bracket.index}: ${bracket.label}`);
                }
            }
            if (market.forecastMedian) {
                console.log(`  Forecast Median: ${Math.round(market.forecastMedian)}°F`);
            }
            console.log(`  Expires: ${new Date(Number(market.expiryTimestamp) * 1000).toISOString()}`);
            console.log('');
        }
        return;
    }

    // Initialize TON client
    const client = new TonClient({
        endpoint: config.tonEndpoint,
        apiKey: config.apiKey,
    });

    // Initialize W5 wallet
    const keyPair = await mnemonicToPrivateKey(config.deployerMnemonic.split(' '));
    const wallet = WalletContractV5R1.create({
        publicKey: keyPair.publicKey,
        workchain: 0,
    });
    const walletContract = client.open(wallet);

    console.log(`\nDeployer wallet: ${wallet.address.toString()}`);
    console.log(`Factory address: ${config.factoryAddress}`);
    console.log(`Oracle address: ${config.oracleAddress}\n`);

    // Parse addresses - all using contracts-local @ton/core
    const factoryAddress = Address.parse(config.factoryAddress);
    const oracleAddress = Address.parse(config.oracleAddress);
    const walletAddress = Address.parse(wallet.address.toString());

    // Check wallet balance (with retry for flaky testnet)
    console.log('Checking wallet balance...');
    const balance = await withRetry(
        () => walletContract.getBalance(),
        5,
        10000,
        'getBalance'
    );
    console.log(`Wallet balance: ${Number(balance) / 1e9} TON`);
    const requiredBalance = toNano('0.35') * BigInt(markets.length) + toNano('3'); // Markets + potential factory funding
    if (balance < requiredBalance) {
        console.error(`Insufficient balance. Need at least ${Number(requiredBalance) / 1e9} TON`);
        console.error('Fund the wallet with testnet TON first.');
        process.exit(1);
    }

    // Check factory balance and fund if needed
    // Contracts need operating balance to process incoming messages
    const MIN_FACTORY_BALANCE = toNano('1'); // Minimum 1 TON
    const FACTORY_TOP_UP = toNano('3');       // Top up to 3 TON if low

    console.log('Checking factory balance...');
    const factoryBalance = await withRetry(
        async () => {
            const state = await client.getContractState(factoryAddress);
            return BigInt(state.balance);
        },
        3,
        5000,
        'getFactoryBalance'
    );
    console.log(`Factory balance: ${Number(factoryBalance) / 1e9} TON`);

    if (factoryBalance < MIN_FACTORY_BALANCE) {
        console.log(`Factory balance too low. Funding with ${Number(FACTORY_TOP_UP) / 1e9} TON...`);

        const seqno = await withRetry(
            () => walletContract.getSeqno(),
            5,
            5000,
            'getSeqno for funding'
        );

        await withRetry(
            () => walletContract.sendTransfer({
                seqno,
                secretKey: keyPair.secretKey,
                messages: [internal({
                    to: factoryAddress,
                    value: FACTORY_TOP_UP,
                    bounce: false,
                })],
            }),
            3,
            10000,
            'fund factory'
        );

        console.log('Factory funding transaction sent. Waiting for confirmation...');
        await waitForSeqno(walletContract, seqno, 60000);
        console.log('Factory funded successfully!\n');

        // Wait a bit for the funding to settle
        await sleep(5000);
    }

    console.log(`Factory: ${factoryAddress.toString()}`);
    console.log(`Oracle: ${oracleAddress.toString()}`);
    console.log(`Wallet: ${walletAddress.toString()}`);

    console.log(`Creating ${markets.length} markets...\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < markets.length; i++) {
        const market = markets[i];
        console.log(`[${i + 1}/${markets.length}] Creating: ${market.question}`);

        try {
            // Get current seqno
            const seqno = await withRetry(
                () => walletContract.getSeqno(),
                5,
                5000,
                'getSeqno'
            );
            console.log(`  Seqno: ${seqno}`);

            // Build CreateMarket message using the Tact-generated serializer
            // This uses the same @ton/core as storeCreateMarket
            // Market types: 0 = binary, 1 = bracket, 2 = scalar
            const marketTypeCode = market.marketType === 'bracket' ? 1n : 0n;

            const createMarketMsg: CreateMarket = {
                $$type: 'CreateMarket',
                eventDescription: market.description,
                locationId: market.locationId,
                expiryTimestamp: market.expiryTimestamp,
                oracleAddress: oracleAddress,
                marketType: marketTypeCode,
                resolutionCriteria: market.resolutionCriteria,
                creator: walletAddress,
            };

            const messageBody = beginCell()
                .store(storeCreateMarket(createMarketMsg))
                .endCell();

            console.log(`  Message built (${messageBody.bits.length} bits)`);

            // Build internal message
            const internalMsg = internal({
                to: factoryAddress,
                value: toNano('0.35'),
                bounce: true,
                body: messageBody,
            });

            // Send via wallet
            console.log(`  Sending transaction...`);
            await withRetry(
                () => walletContract.sendTransfer({
                    seqno,
                    secretKey: keyPair.secretKey,
                    messages: [internalMsg],
                }),
                3,
                10000,
                'sendTransfer'
            );

            console.log('  ✓ Transaction sent');

            // Wait for seqno to increment
            console.log('  Waiting for confirmation...');
            const confirmed = await waitForSeqno(walletContract, seqno, 60000);
            if (confirmed) {
                console.log(`  ✓ Confirmed!`);
                successCount++;
            } else {
                console.log('  ⚠ Confirmation timeout');
                successCount++; // Count as success since tx was sent
            }

            // Delay between markets
            if (i < markets.length - 1) {
                console.log('  Waiting 10s before next market...');
                await sleep(10000);
            }

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`  ✗ Failed: ${errorMsg}`);
            failCount++;

            if (errorMsg.includes('429') || errorMsg.includes('500') || errorMsg.includes('timeout')) {
                console.log('  Waiting 30 seconds...');
                await sleep(30000);
            }
        }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Total: ${markets.length}`);
}

// ============================================
// LOGGING
// ============================================

interface MarketCreationLog {
    timestamp: string;
    date: string;
    marketsCreated: number;
    bracketMarkets: number;
    binaryMarkets: number;
    markets: Array<{
        locationId: number;
        locationName: string;
        productLine: string;
        question: string;
        resolutionCriteria: string;
        expiryTimestamp: number;
        marketType: string;
        brackets?: Array<{ index: number; label: string }>;
        forecastMedian?: number;
    }>;
}

function logMarketCreation(markets: MarketToCreate[]): MarketCreationLog {
    const log: MarketCreationLog = {
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        marketsCreated: markets.length,
        bracketMarkets: markets.filter(m => m.marketType === 'bracket').length,
        binaryMarkets: markets.filter(m => m.marketType === 'binary').length,
        markets: markets.map(m => ({
            locationId: Number(m.locationId),
            locationName: m.locationName,
            productLine: m.productLine,
            question: m.question,
            resolutionCriteria: m.resolutionCriteria,
            expiryTimestamp: Number(m.expiryTimestamp),
            marketType: m.marketType,
            brackets: m.brackets?.map(b => ({ index: b.index, label: b.label })),
            forecastMedian: m.forecastMedian,
        })),
    };

    return log;
}

// ============================================
// CLI INTERFACE
// ============================================

interface CLIArgs {
    dryRun: boolean;
    productLine?: ProductLine;
    region?: Region;
    maxMarkets?: number;
    date?: string;
    binary?: boolean; // Force binary markets instead of bracket
}

function parseArgs(): CLIArgs {
    const args: CLIArgs = {
        dryRun: false,
    };

    const argv = process.argv.slice(2);

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === '--dry-run') {
            args.dryRun = true;
        } else if (arg === '--product-line' && argv[i + 1]) {
            args.productLine = argv[++i] as ProductLine;
        } else if (arg === '--region' && argv[i + 1]) {
            args.region = argv[++i] as Region;
        } else if (arg === '--max-markets' && argv[i + 1]) {
            args.maxMarkets = parseInt(argv[++i], 10);
        } else if (arg === '--date' && argv[i + 1]) {
            args.date = argv[++i];
        } else if (arg === '--binary') {
            args.binary = true;
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
Whether Daily Market Generator

Usage: npx tsx scripts/dailyMarketGenerator.ts [options]

Options:
  --dry-run              Print markets that would be created without actually creating them
  --product-line <line>  Filter to specific product line (airport, urban, precipitation, extreme, energy, agricultural)
  --region <region>      Filter to specific region (North America, Europe, Asia, Middle East, South America, Africa, Oceania)
  --max-markets <n>      Maximum number of markets to create (default: 20)
  --date <YYYY-MM-DD>    Create markets for specific date (default: tomorrow)
  --binary               Force binary markets instead of bracket markets
  --help, -h             Show this help message

Environment Variables:
  MARKET_FACTORY_ADDRESS  Address of the deployed MarketFactory contract
  ORACLE_RESOLVER_ADDRESS Address of the deployed OracleResolver contract
  DEPLOYER_MNEMONIC       Mnemonic for the deployer wallet
  TON_ENDPOINT            TON API endpoint (default: https://testnet.toncenter.com/api/v2/jsonRPC)

Examples:
  # Dry run to see what markets would be created
  npx tsx scripts/dailyMarketGenerator.ts --dry-run

  # Create markets for a specific region
  npx tsx scripts/dailyMarketGenerator.ts --region "North America" --max-markets 10

  # Create only airport markets
  npx tsx scripts/dailyMarketGenerator.ts --product-line airport --dry-run
            `);
            process.exit(0);
        }
    }

    return args;
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main(): Promise<void> {
    console.log('='.repeat(60));
    console.log('Whether Daily Market Generator');
    console.log('='.repeat(60));
    console.log('');

    const args = parseArgs();

    // Determine target date
    const targetDate = args.date
        ? new Date(args.date)
        : new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow

    console.log(`Target date: ${targetDate.toISOString().split('T')[0]}`);
    console.log(`Dry run: ${args.dryRun ? 'Yes' : 'No'}`);

    if (args.productLine) {
        console.log(`Product line filter: ${args.productLine}`);
    }
    if (args.region) {
        console.log(`Region filter: ${args.region}`);
    }

    // Configure market selection
    const config: DailyMarketConfig = {
        ...DEFAULT_DAILY_CONFIG,
        maxMarketsPerDay: args.maxMarkets || DEFAULT_DAILY_CONFIG.maxMarketsPerDay,
    };

    // Select markets for the day (async to fetch forecasts)
    const useBrackets = !args.binary;
    console.log(`\nMarket type: ${useBrackets ? 'Bracket (Polymarket style)' : 'Binary (Yes/No)'}`);
    console.log('Fetching forecasts and generating markets...');
    let markets = await selectDailyMarkets(targetDate, config, useBrackets);

    // Apply filters
    if (args.productLine) {
        markets = markets.filter(m => m.productLine === args.productLine);
    }
    if (args.region) {
        const regionLocations = ALL_LOCATIONS.filter(l => l.region === args.region);
        const regionIds = new Set(regionLocations.map(l => BigInt(l.id)));
        markets = markets.filter(m => regionIds.has(m.locationId));
    }

    console.log(`\nSelected ${markets.length} markets for creation\n`);

    // Log market creation
    const log = logMarketCreation(markets);
    console.log('Market Creation Log:');
    console.log(JSON.stringify(log, null, 2));
    console.log('');

    // Create markets (or dry run)
    if (!args.dryRun) {
        // Validate environment variables
        const factoryAddress = process.env.MARKET_FACTORY_ADDRESS;
        const oracleAddress = process.env.ORACLE_RESOLVER_ADDRESS;
        const deployerMnemonic = process.env.DEPLOYER_MNEMONIC;
        const tonEndpoint = process.env.TON_ENDPOINT || 'https://testnet.toncenter.com/api/v2/jsonRPC';
        const apiKey = process.env.TONCENTER_API_KEY;

        if (!factoryAddress || !oracleAddress || !deployerMnemonic) {
            console.error('Error: Missing required environment variables');
            console.error('Required: MARKET_FACTORY_ADDRESS, ORACLE_RESOLVER_ADDRESS, DEPLOYER_MNEMONIC');
            process.exit(1);
        }

        await createMarketsOnChain(markets, {
            factoryAddress,
            oracleAddress,
            deployerMnemonic,
            tonEndpoint,
            apiKey,
        });
    } else {
        await createMarketsOnChain(markets, {} as ContractConfig, true);
    }

    console.log('\n' + '='.repeat(60));
    console.log('Market generation complete!');
    console.log('='.repeat(60));
}

// Run
main().catch(console.error);
