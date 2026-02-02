// Safe BigInt to Number conversion to prevent overflow on mobile devices
// Values > 2^53 would lose precision with direct Number() conversion
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export function safeBigIntToNumber(value: bigint): number {
    if (value > MAX_SAFE_BIGINT) {
        // For very large values, divide first then convert to avoid overflow
        return Number(value / BigInt(1e9)) * 1e9;
    }
    return Number(value);
}

export function formatTon(amount: bigint): string {
    const ton = safeBigIntToNumber(amount) / 1e9;
    if (ton >= 1000000) {
        return `${(ton / 1000000).toFixed(2)}M`;
    }
    if (ton >= 1000) {
        return `${(ton / 1000).toFixed(2)}K`;
    }
    if (ton >= 1) {
        return ton.toFixed(2);
    }
    if (ton >= 0.01) {
        return ton.toFixed(4);
    }
    return ton.toFixed(6);
}

export function formatPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
}

import type { TemperatureUnit } from '../store/settings';

// Format temperature from centidegrees (stored value) with unit preference
// Note: The backend stores temperatures in centidegrees Fahrenheit
export function formatTemperature(centidegrees: number, unit: TemperatureUnit = 'C'): string {
    const fahrenheit = centidegrees / 100;
    if (unit === 'F') {
        return `${fahrenheit.toFixed(0)}°F`;
    }
    // Convert F to C: (F - 32) * 5/9
    const celsius = (fahrenheit - 32) * 5 / 9;
    return `${celsius.toFixed(0)}°C`;
}

export function formatDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export function formatDateTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = timestamp * 1000 - now;

    if (diff < 0) {
        const absDiff = Math.abs(diff);
        if (absDiff < 60000) return 'just now';
        if (absDiff < 3600000) return `${Math.floor(absDiff / 60000)}m ago`;
        if (absDiff < 86400000) return `${Math.floor(absDiff / 3600000)}h ago`;
        return `${Math.floor(absDiff / 86400000)}d ago`;
    }

    if (diff < 60000) return 'in a moment';
    if (diff < 3600000) return `in ${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `in ${Math.floor(diff / 3600000)}h`;
    return `in ${Math.floor(diff / 86400000)}d`;
}

export function formatAddress(address: string, chars: number = 4): string {
    if (address.length <= chars * 2 + 3) return address;
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatUSD(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
}

export function formatWindSpeed(speedMph: number): string {
    return `${speedMph.toFixed(0)} mph`;
}

export function formatWindDirection(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

export function formatPressure(hPa: number): string {
    const inHg = hPa * 0.02953;
    return `${inHg.toFixed(2)} inHg`;
}

export function formatHumidity(percent: number): string {
    return `${percent.toFixed(0)}%`;
}

export function formatVisibility(miles: number): string {
    if (miles >= 10) return '10+ mi';
    return `${miles.toFixed(1)} mi`;
}

export function formatPrecipitation(inches: number): string {
    if (inches === 0) return '0.00"';
    if (inches < 0.01) return 'Trace';
    return `${inches.toFixed(2)}"`;
}

export function formatTemperatureC(celsius: number): string {
    return `${celsius.toFixed(0)}°C`;
}

export function formatTemperatureF(celsius: number): string {
    const fahrenheit = (celsius * 9 / 5) + 32;
    return `${fahrenheit.toFixed(0)}°F`;
}

// Format temperature from Celsius with unit preference
export function formatTemperatureFromCelsius(celsius: number, unit: TemperatureUnit = 'C'): string {
    if (unit === 'F') {
        const fahrenheit = (celsius * 9 / 5) + 32;
        return `${fahrenheit.toFixed(0)}°F`;
    }
    return `${celsius.toFixed(0)}°C`;
}

export function celsiusToFahrenheit(celsius: number): number {
    return (celsius * 9 / 5) + 32;
}

export function getWeatherConditionLabel(code: string): string {
    const conditions: Record<string, string> = {
        'clear': 'Clear',
        'mostly_clear': 'Mostly Clear',
        'partly_cloudy': 'Partly Cloudy',
        'cloudy': 'Cloudy',
        'overcast': 'Overcast',
        'fog': 'Fog',
        'drizzle': 'Drizzle',
        'rain': 'Rain',
        'rain_heavy': 'Heavy Rain',
        'snow': 'Snow',
        'snow_heavy': 'Heavy Snow',
        'thunderstorm': 'Thunderstorm',
        'hail': 'Hail',
    };
    return conditions[code] || code;
}

export function getWeatherIcon(condition: string): string {
    const icons: Record<string, string> = {
        'clear': '/assets/weather/clear.png',
        'mostly_clear': '/assets/weather/clear.png',
        'partly_cloudy': '/assets/weather/cloudy.png',
        'cloudy': '/assets/weather/cloudy.png',
        'overcast': '/assets/weather/cloudy.png',
        'fog': '/assets/weather/cloudy.png',
        'drizzle': '/assets/weather/rain.png',
        'rain': '/assets/weather/rain.png',
        'rain_heavy': '/assets/weather/storm.png',
        'snow': '/assets/weather/snow.png',
        'snow_heavy': '/assets/weather/snow.png',
        'thunderstorm': '/assets/weather/storm.png',
        'hail': '/assets/weather/storm.png',
    };
    return icons[condition] || '/assets/weather/clear.png';
}

// Dynamic market icons and labels based on resolution type
export type MarketResolutionType = 'temp_high' | 'temp_low' | 'precipitation' | 'visibility' | 'wind_speed' | 'conditions';

export interface MarketIcons {
    yesIcon: string;
    noIcon: string;
    yesLabel: string;
    noLabel: string;
}

export function getMarketIcons(resolutionType: MarketResolutionType | undefined): MarketIcons {
    switch (resolutionType) {
        case 'temp_high':
        case 'temp_low':
            return {
                yesIcon: '/assets/weather/clear.png',  // sunny = hot
                noIcon: '/assets/weather/snow.png',    // cold
                yesLabel: 'YES',
                noLabel: 'NO',
            };
        case 'precipitation':
            return {
                yesIcon: '/assets/weather/rain.png',
                noIcon: '/assets/weather/clear.png',
                yesLabel: 'RAIN',
                noLabel: 'NO RAIN',
            };
        case 'wind_speed':
            return {
                yesIcon: '/assets/weather/wind.png',
                noIcon: '/assets/weather/clear.png',
                yesLabel: 'WINDY',
                noLabel: 'CALM',
            };
        case 'visibility':
            return {
                yesIcon: '/assets/weather/cloudy.png',
                noIcon: '/assets/weather/clear.png',
                yesLabel: 'LOW VIS',
                noLabel: 'CLEAR',
            };
        case 'conditions':
        default:
            return {
                yesIcon: '/assets/weather/clear.png',
                noIcon: '/assets/weather/cloudy.png',
                yesLabel: 'YES',
                noLabel: 'NO',
            };
    }
}
