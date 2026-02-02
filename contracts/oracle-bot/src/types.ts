/**
 * Whether Oracle Bot - Type Definitions
 */

// Weather condition codes (matching contract)
export enum WeatherCondition {
    CLEAR = 0,
    CLOUDY = 1,
    RAIN = 2,
    SNOW = 3,
    FOG = 4,
    STORM = 5,
}

// Location type
export enum LocationType {
    AIRPORT = 'airport',
    CITY = 'city',
}

// Location definition
export interface Location {
    id: number;
    code: string;
    name: string;
    type: LocationType;
    latitude: number;
    longitude: number;
    icao?: string; // For airports only
    timezone: string;
}

// Normalized weather data (all units converted to contract format)
export interface WeatherData {
    locationId: number;
    timestamp: number;           // Unix timestamp
    temperature: number;         // Celsius × 10 (e.g., 255 = 25.5°C)
    temperatureMax: number;      // Daily high × 10
    temperatureMin: number;      // Daily low × 10
    precipitation: number;       // mm × 10
    visibility: number;          // meters
    windSpeed: number;           // knots × 10
    windGust: number;            // knots × 10
    pressure: number;            // hPa
    humidity: number;            // 0-100
    conditions: WeatherCondition;
    source: string;              // Source identifier
    rawData?: string;            // Raw response for hashing
}

// Weather source interface
export interface WeatherSource {
    name: string;
    priority: number; // Lower = higher priority
    fetch(location: Location): Promise<WeatherData | null>;
}

// Consensus result
export interface ConsensusResult {
    success: boolean;
    data: WeatherData | null;
    sourceCount: number;
    sources: string[];
    sourceHash: bigint;
    discrepancies?: {
        field: string;
        values: number[];
        difference: number;
    }[];
}

// Consensus tolerances
export interface ConsensusTolerance {
    temperature: number;     // ±1.0°C = 10 in int16 format
    precipitation: number;   // ±5.0mm = 50 in uint16 format
    visibility: number;      // ±500m
    windSpeed: number;       // ±5 knots = 50 in uint16 format
    pressure: number;        // ±5 hPa
    humidity: number;        // ±10%
}

// Bot configuration
export interface BotConfig {
    tonEndpoint: string;
    tonApiKey: string;
    oracleContract: string;
    walletMnemonic: string;
    checkwxApiKey?: string;
    openweatherApiKey?: string;
    submitIntervalMs: number;
    locations: string[];
    logLevel: string;
}

// Submission result
export interface SubmissionResult {
    success: boolean;
    locationId: number;
    txHash?: string;
    error?: string;
}

// API Response types

// CheckWX METAR response
export interface CheckWXResponse {
    results: number;
    data: CheckWXObservation[];
}

export interface CheckWXObservation {
    icao: string;
    observed: string;
    raw_text: string;
    temperature?: {
        celsius: number;
    };
    dewpoint?: {
        celsius: number;
    };
    wind?: {
        speed_kts: number;
        gust_kts?: number;
        degrees: number;
    };
    visibility?: {
        meters: string;
        miles: string;
    };
    barometer?: {
        hpa: number;
        hg: number;
    };
    humidity?: {
        percent: number;
    };
    clouds?: {
        code: string;
        base_feet_agl: number;
    }[];
    conditions?: {
        code: string;
        text: string;
    }[];
}

// OpenWeatherMap response
export interface OpenWeatherResponse {
    coord: { lon: number; lat: number };
    weather: {
        id: number;
        main: string;
        description: string;
    }[];
    main: {
        temp: number;
        feels_like: number;
        temp_min: number;
        temp_max: number;
        pressure: number;
        humidity: number;
    };
    visibility: number;
    wind: {
        speed: number;
        deg: number;
        gust?: number;
    };
    rain?: { '1h'?: number; '3h'?: number };
    snow?: { '1h'?: number; '3h'?: number };
    clouds: { all: number };
    dt: number;
    sys: { country: string; sunrise: number; sunset: number };
    timezone: number;
    name: string;
}

// Open-Meteo response
export interface OpenMeteoResponse {
    latitude: number;
    longitude: number;
    timezone: string;
    current_weather: {
        temperature: number;
        windspeed: number;
        winddirection: number;
        weathercode: number;
        time: string;
    };
    hourly?: {
        time: string[];
        temperature_2m: number[];
        precipitation: number[];
        visibility: number[];
        windspeed_10m: number[];
        windgusts_10m: number[];
        surface_pressure: number[];
        relativehumidity_2m: number[];
    };
    daily?: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_sum: number[];
    };
}

// Unit conversion constants
export const KNOTS_TO_MS = 0.514444;
export const MS_TO_KNOTS = 1.94384;
export const KMH_TO_KNOTS = 0.539957;
export const MPH_TO_KNOTS = 0.868976;
export const MILES_TO_METERS = 1609.34;
export const FEET_TO_METERS = 0.3048;
