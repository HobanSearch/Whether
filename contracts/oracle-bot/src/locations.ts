/**
 * Whether Oracle Bot - Location Configuration
 * 50 locations: 20 airports (IDs 1001-1041) + 30 cities (IDs 2001-2062)
 */

import { Location, LocationType } from './types';

// Airports (METAR-enabled) - IDs 1001-1041
export const AIRPORTS: Record<string, Location> = {
    // North America
    KJFK: {
        id: 1001, code: 'KJFK', name: 'New York JFK', type: LocationType.AIRPORT,
        latitude: 40.6413, longitude: -73.7781, icao: 'KJFK', timezone: 'America/New_York'
    },
    KLAX: {
        id: 1002, code: 'KLAX', name: 'Los Angeles LAX', type: LocationType.AIRPORT,
        latitude: 33.9425, longitude: -118.4081, icao: 'KLAX', timezone: 'America/Los_Angeles'
    },
    KORD: {
        id: 1003, code: 'KORD', name: 'Chicago O\'Hare', type: LocationType.AIRPORT,
        latitude: 41.9742, longitude: -87.9073, icao: 'KORD', timezone: 'America/Chicago'
    },
    KMIA: {
        id: 1004, code: 'KMIA', name: 'Miami International', type: LocationType.AIRPORT,
        latitude: 25.7959, longitude: -80.2870, icao: 'KMIA', timezone: 'America/New_York'
    },
    CYYZ: {
        id: 1005, code: 'CYYZ', name: 'Toronto Pearson', type: LocationType.AIRPORT,
        latitude: 43.6777, longitude: -79.6248, icao: 'CYYZ', timezone: 'America/Toronto'
    },
    // Europe
    EGLL: {
        id: 1010, code: 'EGLL', name: 'London Heathrow', type: LocationType.AIRPORT,
        latitude: 51.4700, longitude: -0.4543, icao: 'EGLL', timezone: 'Europe/London'
    },
    LFPG: {
        id: 1011, code: 'LFPG', name: 'Paris CDG', type: LocationType.AIRPORT,
        latitude: 49.0097, longitude: 2.5479, icao: 'LFPG', timezone: 'Europe/Paris'
    },
    EDDF: {
        id: 1012, code: 'EDDF', name: 'Frankfurt', type: LocationType.AIRPORT,
        latitude: 50.0379, longitude: 8.5622, icao: 'EDDF', timezone: 'Europe/Berlin'
    },
    EHAM: {
        id: 1013, code: 'EHAM', name: 'Amsterdam Schiphol', type: LocationType.AIRPORT,
        latitude: 52.3105, longitude: 4.7683, icao: 'EHAM', timezone: 'Europe/Amsterdam'
    },
    LEMD: {
        id: 1014, code: 'LEMD', name: 'Madrid Barajas', type: LocationType.AIRPORT,
        latitude: 40.4983, longitude: -3.5676, icao: 'LEMD', timezone: 'Europe/Madrid'
    },
    // Asia
    RJTT: {
        id: 1020, code: 'RJTT', name: 'Tokyo Haneda', type: LocationType.AIRPORT,
        latitude: 35.5494, longitude: 139.7798, icao: 'RJTT', timezone: 'Asia/Tokyo'
    },
    RJAA: {
        id: 1021, code: 'RJAA', name: 'Tokyo Narita', type: LocationType.AIRPORT,
        latitude: 35.7647, longitude: 140.3864, icao: 'RJAA', timezone: 'Asia/Tokyo'
    },
    WSSS: {
        id: 1022, code: 'WSSS', name: 'Singapore Changi', type: LocationType.AIRPORT,
        latitude: 1.3644, longitude: 103.9915, icao: 'WSSS', timezone: 'Asia/Singapore'
    },
    VHHH: {
        id: 1023, code: 'VHHH', name: 'Hong Kong', type: LocationType.AIRPORT,
        latitude: 22.3080, longitude: 113.9185, icao: 'VHHH', timezone: 'Asia/Hong_Kong'
    },
    RKSI: {
        id: 1024, code: 'RKSI', name: 'Seoul Incheon', type: LocationType.AIRPORT,
        latitude: 37.4602, longitude: 126.4407, icao: 'RKSI', timezone: 'Asia/Seoul'
    },
    // Middle East
    OMDB: {
        id: 1030, code: 'OMDB', name: 'Dubai International', type: LocationType.AIRPORT,
        latitude: 25.2532, longitude: 55.3657, icao: 'OMDB', timezone: 'Asia/Dubai'
    },
    OTHH: {
        id: 1031, code: 'OTHH', name: 'Doha Hamad', type: LocationType.AIRPORT,
        latitude: 25.2731, longitude: 51.6081, icao: 'OTHH', timezone: 'Asia/Qatar'
    },
    OMAA: {
        id: 1032, code: 'OMAA', name: 'Abu Dhabi', type: LocationType.AIRPORT,
        latitude: 24.4330, longitude: 54.6511, icao: 'OMAA', timezone: 'Asia/Dubai'
    },
    // Oceania
    YSSY: {
        id: 1040, code: 'YSSY', name: 'Sydney', type: LocationType.AIRPORT,
        latitude: -33.9399, longitude: 151.1753, icao: 'YSSY', timezone: 'Australia/Sydney'
    },
    YMML: {
        id: 1041, code: 'YMML', name: 'Melbourne', type: LocationType.AIRPORT,
        latitude: -37.6690, longitude: 144.8410, icao: 'YMML', timezone: 'Australia/Melbourne'
    },
};

// Cities (API weather) - IDs 2001-2062
export const CITIES: Record<string, Location> = {
    // North America
    NYC: {
        id: 2001, code: 'NYC', name: 'New York City', type: LocationType.CITY,
        latitude: 40.7128, longitude: -74.0060, timezone: 'America/New_York'
    },
    LAX: {
        id: 2002, code: 'LAX', name: 'Los Angeles', type: LocationType.CITY,
        latitude: 34.0522, longitude: -118.2437, timezone: 'America/Los_Angeles'
    },
    CHI: {
        id: 2003, code: 'CHI', name: 'Chicago', type: LocationType.CITY,
        latitude: 41.8781, longitude: -87.6298, timezone: 'America/Chicago'
    },
    MIA: {
        id: 2004, code: 'MIA', name: 'Miami', type: LocationType.CITY,
        latitude: 25.7617, longitude: -80.1918, timezone: 'America/New_York'
    },
    AUS: {
        id: 2005, code: 'AUS', name: 'Austin', type: LocationType.CITY,
        latitude: 30.2672, longitude: -97.7431, timezone: 'America/Chicago'
    },
    TOR: {
        id: 2006, code: 'TOR', name: 'Toronto', type: LocationType.CITY,
        latitude: 43.6532, longitude: -79.3832, timezone: 'America/Toronto'
    },
    // Europe
    LON: {
        id: 2010, code: 'LON', name: 'London', type: LocationType.CITY,
        latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London'
    },
    PAR: {
        id: 2011, code: 'PAR', name: 'Paris', type: LocationType.CITY,
        latitude: 48.8566, longitude: 2.3522, timezone: 'Europe/Paris'
    },
    BER: {
        id: 2012, code: 'BER', name: 'Berlin', type: LocationType.CITY,
        latitude: 52.5200, longitude: 13.4050, timezone: 'Europe/Berlin'
    },
    MAD: {
        id: 2013, code: 'MAD', name: 'Madrid', type: LocationType.CITY,
        latitude: 40.4168, longitude: -3.7038, timezone: 'Europe/Madrid'
    },
    ROM: {
        id: 2014, code: 'ROM', name: 'Rome', type: LocationType.CITY,
        latitude: 41.9028, longitude: 12.4964, timezone: 'Europe/Rome'
    },
    AMS: {
        id: 2015, code: 'AMS', name: 'Amsterdam', type: LocationType.CITY,
        latitude: 52.3676, longitude: 4.9041, timezone: 'Europe/Amsterdam'
    },
    MOS: {
        id: 2016, code: 'MOS', name: 'Moscow', type: LocationType.CITY,
        latitude: 55.7558, longitude: 37.6173, timezone: 'Europe/Moscow'
    },
    // Asia
    TKY: {
        id: 2020, code: 'TKY', name: 'Tokyo', type: LocationType.CITY,
        latitude: 35.6762, longitude: 139.6503, timezone: 'Asia/Tokyo'
    },
    SEL: {
        id: 2021, code: 'SEL', name: 'Seoul', type: LocationType.CITY,
        latitude: 37.5665, longitude: 126.9780, timezone: 'Asia/Seoul'
    },
    SIN: {
        id: 2022, code: 'SIN', name: 'Singapore', type: LocationType.CITY,
        latitude: 1.3521, longitude: 103.8198, timezone: 'Asia/Singapore'
    },
    HKG: {
        id: 2023, code: 'HKG', name: 'Hong Kong', type: LocationType.CITY,
        latitude: 22.3193, longitude: 114.1694, timezone: 'Asia/Hong_Kong'
    },
    MUM: {
        id: 2024, code: 'MUM', name: 'Mumbai', type: LocationType.CITY,
        latitude: 19.0760, longitude: 72.8777, timezone: 'Asia/Kolkata'
    },
    BKK: {
        id: 2025, code: 'BKK', name: 'Bangkok', type: LocationType.CITY,
        latitude: 13.7563, longitude: 100.5018, timezone: 'Asia/Bangkok'
    },
    // Middle East
    DXB: {
        id: 2030, code: 'DXB', name: 'Dubai', type: LocationType.CITY,
        latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai'
    },
    RUH: {
        id: 2031, code: 'RUH', name: 'Riyadh', type: LocationType.CITY,
        latitude: 24.7136, longitude: 46.6753, timezone: 'Asia/Riyadh'
    },
    TLV: {
        id: 2032, code: 'TLV', name: 'Tel Aviv', type: LocationType.CITY,
        latitude: 32.0853, longitude: 34.7818, timezone: 'Asia/Jerusalem'
    },
    // South America
    SAO: {
        id: 2040, code: 'SAO', name: 'São Paulo', type: LocationType.CITY,
        latitude: -23.5505, longitude: -46.6333, timezone: 'America/Sao_Paulo'
    },
    BUE: {
        id: 2041, code: 'BUE', name: 'Buenos Aires', type: LocationType.CITY,
        latitude: -34.6037, longitude: -58.3816, timezone: 'America/Argentina/Buenos_Aires'
    },
    MEX: {
        id: 2042, code: 'MEX', name: 'Mexico City', type: LocationType.CITY,
        latitude: 19.4326, longitude: -99.1332, timezone: 'America/Mexico_City'
    },
    // Africa
    LOS: {
        id: 2050, code: 'LOS', name: 'Lagos', type: LocationType.CITY,
        latitude: 6.5244, longitude: 3.3792, timezone: 'Africa/Lagos'
    },
    CAI: {
        id: 2051, code: 'CAI', name: 'Cairo', type: LocationType.CITY,
        latitude: 30.0444, longitude: 31.2357, timezone: 'Africa/Cairo'
    },
    CPT: {
        id: 2052, code: 'CPT', name: 'Cape Town', type: LocationType.CITY,
        latitude: -33.9249, longitude: 18.4241, timezone: 'Africa/Johannesburg'
    },
    // Oceania
    SYD: {
        id: 2060, code: 'SYD', name: 'Sydney', type: LocationType.CITY,
        latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney'
    },
    MEL: {
        id: 2061, code: 'MEL', name: 'Melbourne', type: LocationType.CITY,
        latitude: -37.8136, longitude: 144.9631, timezone: 'Australia/Melbourne'
    },
    AKL: {
        id: 2062, code: 'AKL', name: 'Auckland', type: LocationType.CITY,
        latitude: -36.8509, longitude: 174.7645, timezone: 'Pacific/Auckland'
    },
};

// Combined locations map
export const ALL_LOCATIONS_MAP: Record<string, Location> = {
    ...AIRPORTS,
    ...CITIES,
};

// Combined locations array
export const ALL_LOCATIONS: Location[] = Object.values(ALL_LOCATIONS_MAP);

// Get location by code
export function getLocation(code: string): Location | undefined {
    return ALL_LOCATIONS_MAP[code.toUpperCase()];
}

// Get location by ID
export function getLocationById(id: number): Location | undefined {
    return Object.values(ALL_LOCATIONS).find(loc => loc.id === id);
}

// Get all airport locations
export function getAirports(): Location[] {
    return Object.values(AIRPORTS);
}

// Get all city locations
export function getCities(): Location[] {
    return Object.values(CITIES);
}

// Check if location is an airport (has ICAO code)
export function isAirport(location: Location): boolean {
    return location.type === LocationType.AIRPORT && !!location.icao;
}

// Get ICAO code for airport, or undefined for cities
export function getIcaoCode(location: Location): string | undefined {
    return location.icao;
}
