/**
 * Whether Market Location Data
 *
 * 50 locations: 20 airports + 30 cities
 * Location IDs: Airports 1001-1999, Cities 2001-2999
 */

import { Location, Region } from '../types';

// ============================================
// AIRPORTS (METAR-enabled)
// Location IDs: 1001-1999
// ============================================

export const AIRPORTS: Location[] = [
    // North America
    {
        id: 1001,
        code: 'KJFK',
        name: 'New York JFK',
        type: 'airport',
        coordinates: { lat: 40.6413, lon: -73.7781 },
        timezone: 'America/New_York',
        country: 'US',
        region: 'North America',
        icao: 'KJFK',
        isActive: true,
    },
    {
        id: 1002,
        code: 'KLAX',
        name: 'Los Angeles LAX',
        type: 'airport',
        coordinates: { lat: 33.9425, lon: -118.4081 },
        timezone: 'America/Los_Angeles',
        country: 'US',
        region: 'North America',
        icao: 'KLAX',
        isActive: true,
    },
    {
        id: 1003,
        code: 'KORD',
        name: "Chicago O'Hare",
        type: 'airport',
        coordinates: { lat: 41.9742, lon: -87.9073 },
        timezone: 'America/Chicago',
        country: 'US',
        region: 'North America',
        icao: 'KORD',
        isActive: true,
    },
    {
        id: 1004,
        code: 'KMIA',
        name: 'Miami International',
        type: 'airport',
        coordinates: { lat: 25.7959, lon: -80.287 },
        timezone: 'America/New_York',
        country: 'US',
        region: 'North America',
        icao: 'KMIA',
        isActive: true,
    },
    {
        id: 1005,
        code: 'CYYZ',
        name: 'Toronto Pearson',
        type: 'airport',
        coordinates: { lat: 43.6777, lon: -79.6248 },
        timezone: 'America/Toronto',
        country: 'CA',
        region: 'North America',
        icao: 'CYYZ',
        isActive: true,
    },
    // Europe
    {
        id: 1010,
        code: 'EGLL',
        name: 'London Heathrow',
        type: 'airport',
        coordinates: { lat: 51.47, lon: -0.4543 },
        timezone: 'Europe/London',
        country: 'GB',
        region: 'Europe',
        icao: 'EGLL',
        isActive: true,
    },
    {
        id: 1011,
        code: 'LFPG',
        name: 'Paris CDG',
        type: 'airport',
        coordinates: { lat: 49.0097, lon: 2.5479 },
        timezone: 'Europe/Paris',
        country: 'FR',
        region: 'Europe',
        icao: 'LFPG',
        isActive: true,
    },
    {
        id: 1012,
        code: 'EDDF',
        name: 'Frankfurt',
        type: 'airport',
        coordinates: { lat: 50.0379, lon: 8.5622 },
        timezone: 'Europe/Berlin',
        country: 'DE',
        region: 'Europe',
        icao: 'EDDF',
        isActive: true,
    },
    {
        id: 1013,
        code: 'EHAM',
        name: 'Amsterdam Schiphol',
        type: 'airport',
        coordinates: { lat: 52.3105, lon: 4.7683 },
        timezone: 'Europe/Amsterdam',
        country: 'NL',
        region: 'Europe',
        icao: 'EHAM',
        isActive: true,
    },
    {
        id: 1014,
        code: 'LEMD',
        name: 'Madrid Barajas',
        type: 'airport',
        coordinates: { lat: 40.4983, lon: -3.5676 },
        timezone: 'Europe/Madrid',
        country: 'ES',
        region: 'Europe',
        icao: 'LEMD',
        isActive: true,
    },
    // Asia
    {
        id: 1020,
        code: 'RJTT',
        name: 'Tokyo Haneda',
        type: 'airport',
        coordinates: { lat: 35.5494, lon: 139.7798 },
        timezone: 'Asia/Tokyo',
        country: 'JP',
        region: 'Asia',
        icao: 'RJTT',
        isActive: true,
    },
    {
        id: 1021,
        code: 'RJAA',
        name: 'Tokyo Narita',
        type: 'airport',
        coordinates: { lat: 35.772, lon: 140.3929 },
        timezone: 'Asia/Tokyo',
        country: 'JP',
        region: 'Asia',
        icao: 'RJAA',
        isActive: true,
    },
    {
        id: 1022,
        code: 'WSSS',
        name: 'Singapore Changi',
        type: 'airport',
        coordinates: { lat: 1.3644, lon: 103.9915 },
        timezone: 'Asia/Singapore',
        country: 'SG',
        region: 'Asia',
        icao: 'WSSS',
        isActive: true,
    },
    {
        id: 1023,
        code: 'VHHH',
        name: 'Hong Kong',
        type: 'airport',
        coordinates: { lat: 22.308, lon: 113.9185 },
        timezone: 'Asia/Hong_Kong',
        country: 'HK',
        region: 'Asia',
        icao: 'VHHH',
        isActive: true,
    },
    {
        id: 1024,
        code: 'RKSI',
        name: 'Seoul Incheon',
        type: 'airport',
        coordinates: { lat: 37.4602, lon: 126.4407 },
        timezone: 'Asia/Seoul',
        country: 'KR',
        region: 'Asia',
        icao: 'RKSI',
        isActive: true,
    },
    // Middle East
    {
        id: 1030,
        code: 'OMDB',
        name: 'Dubai International',
        type: 'airport',
        coordinates: { lat: 25.2528, lon: 55.3644 },
        timezone: 'Asia/Dubai',
        country: 'AE',
        region: 'Middle East',
        icao: 'OMDB',
        isActive: true,
    },
    {
        id: 1031,
        code: 'OTHH',
        name: 'Doha Hamad',
        type: 'airport',
        coordinates: { lat: 25.2731, lon: 51.6081 },
        timezone: 'Asia/Qatar',
        country: 'QA',
        region: 'Middle East',
        icao: 'OTHH',
        isActive: true,
    },
    {
        id: 1032,
        code: 'OMAA',
        name: 'Abu Dhabi',
        type: 'airport',
        coordinates: { lat: 24.433, lon: 54.6511 },
        timezone: 'Asia/Dubai',
        country: 'AE',
        region: 'Middle East',
        icao: 'OMAA',
        isActive: true,
    },
    // Oceania
    {
        id: 1040,
        code: 'YSSY',
        name: 'Sydney Airport',
        type: 'airport',
        coordinates: { lat: -33.9399, lon: 151.1753 },
        timezone: 'Australia/Sydney',
        country: 'AU',
        region: 'Oceania',
        icao: 'YSSY',
        isActive: true,
    },
    {
        id: 1041,
        code: 'YMML',
        name: 'Melbourne Airport',
        type: 'airport',
        coordinates: { lat: -37.669, lon: 144.841 },
        timezone: 'Australia/Melbourne',
        country: 'AU',
        region: 'Oceania',
        icao: 'YMML',
        isActive: true,
    },
];

// ============================================
// CITIES (Temperature markets)
// Location IDs: 2001-2999
// ============================================

export const CITIES: Location[] = [
    // North America
    {
        id: 2001,
        code: 'NYC',
        name: 'New York City',
        type: 'city',
        coordinates: { lat: 40.7128, lon: -74.006 },
        timezone: 'America/New_York',
        country: 'US',
        region: 'North America',
        isActive: true,
    },
    {
        id: 2002,
        code: 'LAX',
        name: 'Los Angeles',
        type: 'city',
        coordinates: { lat: 34.0522, lon: -118.2437 },
        timezone: 'America/Los_Angeles',
        country: 'US',
        region: 'North America',
        isActive: true,
    },
    {
        id: 2003,
        code: 'CHI',
        name: 'Chicago',
        type: 'city',
        coordinates: { lat: 41.8781, lon: -87.6298 },
        timezone: 'America/Chicago',
        country: 'US',
        region: 'North America',
        isActive: true,
    },
    {
        id: 2004,
        code: 'MIA',
        name: 'Miami',
        type: 'city',
        coordinates: { lat: 25.7617, lon: -80.1918 },
        timezone: 'America/New_York',
        country: 'US',
        region: 'North America',
        isActive: true,
    },
    {
        id: 2005,
        code: 'AUS',
        name: 'Austin',
        type: 'city',
        coordinates: { lat: 30.2672, lon: -97.7431 },
        timezone: 'America/Chicago',
        country: 'US',
        region: 'North America',
        isActive: true,
    },
    {
        id: 2006,
        code: 'TOR',
        name: 'Toronto',
        type: 'city',
        coordinates: { lat: 43.6532, lon: -79.3832 },
        timezone: 'America/Toronto',
        country: 'CA',
        region: 'North America',
        isActive: true,
    },
    // Europe
    {
        id: 2010,
        code: 'LON',
        name: 'London',
        type: 'city',
        coordinates: { lat: 51.5074, lon: -0.1278 },
        timezone: 'Europe/London',
        country: 'GB',
        region: 'Europe',
        isActive: true,
    },
    {
        id: 2011,
        code: 'PAR',
        name: 'Paris',
        type: 'city',
        coordinates: { lat: 48.8566, lon: 2.3522 },
        timezone: 'Europe/Paris',
        country: 'FR',
        region: 'Europe',
        isActive: true,
    },
    {
        id: 2012,
        code: 'BER',
        name: 'Berlin',
        type: 'city',
        coordinates: { lat: 52.52, lon: 13.405 },
        timezone: 'Europe/Berlin',
        country: 'DE',
        region: 'Europe',
        isActive: true,
    },
    {
        id: 2013,
        code: 'MAD',
        name: 'Madrid',
        type: 'city',
        coordinates: { lat: 40.4168, lon: -3.7038 },
        timezone: 'Europe/Madrid',
        country: 'ES',
        region: 'Europe',
        isActive: true,
    },
    {
        id: 2014,
        code: 'ROM',
        name: 'Rome',
        type: 'city',
        coordinates: { lat: 41.9028, lon: 12.4964 },
        timezone: 'Europe/Rome',
        country: 'IT',
        region: 'Europe',
        isActive: true,
    },
    {
        id: 2015,
        code: 'AMS',
        name: 'Amsterdam',
        type: 'city',
        coordinates: { lat: 52.3676, lon: 4.9041 },
        timezone: 'Europe/Amsterdam',
        country: 'NL',
        region: 'Europe',
        isActive: true,
    },
    {
        id: 2016,
        code: 'MOS',
        name: 'Moscow',
        type: 'city',
        coordinates: { lat: 55.7558, lon: 37.6173 },
        timezone: 'Europe/Moscow',
        country: 'RU',
        region: 'Europe',
        isActive: true,
    },
    // Asia
    {
        id: 2020,
        code: 'TKY',
        name: 'Tokyo',
        type: 'city',
        coordinates: { lat: 35.6762, lon: 139.6503 },
        timezone: 'Asia/Tokyo',
        country: 'JP',
        region: 'Asia',
        isActive: true,
    },
    {
        id: 2021,
        code: 'SEL',
        name: 'Seoul',
        type: 'city',
        coordinates: { lat: 37.5665, lon: 126.978 },
        timezone: 'Asia/Seoul',
        country: 'KR',
        region: 'Asia',
        isActive: true,
    },
    {
        id: 2022,
        code: 'SIN',
        name: 'Singapore',
        type: 'city',
        coordinates: { lat: 1.3521, lon: 103.8198 },
        timezone: 'Asia/Singapore',
        country: 'SG',
        region: 'Asia',
        isActive: true,
    },
    {
        id: 2023,
        code: 'HKG',
        name: 'Hong Kong',
        type: 'city',
        coordinates: { lat: 22.3193, lon: 114.1694 },
        timezone: 'Asia/Hong_Kong',
        country: 'HK',
        region: 'Asia',
        isActive: true,
    },
    {
        id: 2024,
        code: 'MUM',
        name: 'Mumbai',
        type: 'city',
        coordinates: { lat: 19.076, lon: 72.8777 },
        timezone: 'Asia/Kolkata',
        country: 'IN',
        region: 'Asia',
        isActive: true,
    },
    {
        id: 2025,
        code: 'BKK',
        name: 'Bangkok',
        type: 'city',
        coordinates: { lat: 13.7563, lon: 100.5018 },
        timezone: 'Asia/Bangkok',
        country: 'TH',
        region: 'Asia',
        isActive: true,
    },
    // Middle East
    {
        id: 2030,
        code: 'DXB',
        name: 'Dubai',
        type: 'city',
        coordinates: { lat: 25.2048, lon: 55.2708 },
        timezone: 'Asia/Dubai',
        country: 'AE',
        region: 'Middle East',
        isActive: true,
    },
    {
        id: 2031,
        code: 'RUH',
        name: 'Riyadh',
        type: 'city',
        coordinates: { lat: 24.7136, lon: 46.6753 },
        timezone: 'Asia/Riyadh',
        country: 'SA',
        region: 'Middle East',
        isActive: true,
    },
    {
        id: 2032,
        code: 'TLV',
        name: 'Tel Aviv',
        type: 'city',
        coordinates: { lat: 32.0853, lon: 34.7818 },
        timezone: 'Asia/Jerusalem',
        country: 'IL',
        region: 'Middle East',
        isActive: true,
    },
    // South America
    {
        id: 2040,
        code: 'SAO',
        name: 'São Paulo',
        type: 'city',
        coordinates: { lat: -23.5505, lon: -46.6333 },
        timezone: 'America/Sao_Paulo',
        country: 'BR',
        region: 'South America',
        isActive: true,
    },
    {
        id: 2041,
        code: 'BUE',
        name: 'Buenos Aires',
        type: 'city',
        coordinates: { lat: -34.6037, lon: -58.3816 },
        timezone: 'America/Argentina/Buenos_Aires',
        country: 'AR',
        region: 'South America',
        isActive: true,
    },
    {
        id: 2042,
        code: 'MEX',
        name: 'Mexico City',
        type: 'city',
        coordinates: { lat: 19.4326, lon: -99.1332 },
        timezone: 'America/Mexico_City',
        country: 'MX',
        region: 'North America',
        isActive: true,
    },
    // Africa
    {
        id: 2050,
        code: 'LOS',
        name: 'Lagos',
        type: 'city',
        coordinates: { lat: 6.5244, lon: 3.3792 },
        timezone: 'Africa/Lagos',
        country: 'NG',
        region: 'Africa',
        isActive: true,
    },
    {
        id: 2051,
        code: 'CAI',
        name: 'Cairo',
        type: 'city',
        coordinates: { lat: 30.0444, lon: 31.2357 },
        timezone: 'Africa/Cairo',
        country: 'EG',
        region: 'Africa',
        isActive: true,
    },
    {
        id: 2052,
        code: 'CPT',
        name: 'Cape Town',
        type: 'city',
        coordinates: { lat: -33.9249, lon: 18.4241 },
        timezone: 'Africa/Johannesburg',
        country: 'ZA',
        region: 'Africa',
        isActive: true,
    },
    // Oceania
    {
        id: 2060,
        code: 'SYD',
        name: 'Sydney',
        type: 'city',
        coordinates: { lat: -33.8688, lon: 151.2093 },
        timezone: 'Australia/Sydney',
        country: 'AU',
        region: 'Oceania',
        isActive: true,
    },
    {
        id: 2061,
        code: 'MEL',
        name: 'Melbourne',
        type: 'city',
        coordinates: { lat: -37.8136, lon: 144.9631 },
        timezone: 'Australia/Melbourne',
        country: 'AU',
        region: 'Oceania',
        isActive: true,
    },
    {
        id: 2062,
        code: 'AKL',
        name: 'Auckland',
        type: 'city',
        coordinates: { lat: -36.8485, lon: 174.7633 },
        timezone: 'Pacific/Auckland',
        country: 'NZ',
        region: 'Oceania',
        isActive: true,
    },
];

// ============================================
// COMBINED EXPORTS
// ============================================

export const ALL_LOCATIONS: Location[] = [...AIRPORTS, ...CITIES];

// Alias for backward compatibility with imports using LOCATIONS
export const LOCATIONS = ALL_LOCATIONS;

export const LOCATIONS_BY_ID: Record<number, Location> = ALL_LOCATIONS.reduce(
    (acc, loc) => ({ ...acc, [loc.id]: loc }),
    {}
);

export const LOCATIONS_BY_CODE: Record<string, Location> = ALL_LOCATIONS.reduce(
    (acc, loc) => ({ ...acc, [loc.code]: loc }),
    {}
);

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getLocationById(id: number): Location | undefined {
    return LOCATIONS_BY_ID[id];
}

export function getLocationByCode(code: string): Location | undefined {
    return LOCATIONS_BY_CODE[code.toUpperCase()];
}

export function getLocationsByType(type: 'airport' | 'city'): Location[] {
    return ALL_LOCATIONS.filter((loc) => loc.type === type);
}

export function getLocationsByRegion(region: Region): Location[] {
    return ALL_LOCATIONS.filter((loc) => loc.region === region);
}

export function getLocationsByCountry(country: string): Location[] {
    return ALL_LOCATIONS.filter((loc) => loc.country === country.toUpperCase());
}

export function searchLocations(query: string, limit = 10): Location[] {
    const lowerQuery = query.toLowerCase();
    return ALL_LOCATIONS.filter(
        (loc) =>
            loc.name.toLowerCase().includes(lowerQuery) ||
            loc.code.toLowerCase().includes(lowerQuery)
    ).slice(0, limit);
}

export function getRegions(): Region[] {
    const regions = new Set(ALL_LOCATIONS.map((loc) => loc.region));
    return Array.from(regions).sort() as Region[];
}

export function getCountries(region?: Region): string[] {
    const locations = region ? getLocationsByRegion(region) : ALL_LOCATIONS;
    const countries = new Set(locations.map((loc) => loc.country));
    return Array.from(countries).sort();
}

// ============================================
// TESTNET SUBSET (5 locations for testing)
// ============================================

export const TESTNET_LOCATION_IDS = [1001, 1010, 1020, 1030, 1040];
export const TESTNET_LOCATIONS = TESTNET_LOCATION_IDS.map((id) => LOCATIONS_BY_ID[id]);
