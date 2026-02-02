/**
 * Whether Oracle Bot - Base Weather Source
 */

import { Location, WeatherData, WeatherSource, WeatherCondition } from '../types';

export abstract class BaseWeatherSource implements WeatherSource {
    abstract name: string;
    abstract priority: number;

    abstract fetch(location: Location): Promise<WeatherData | null>;

    // Helper: Convert Fahrenheit to Celsius × 10
    protected fahrenheitToCelsius10(f: number): number {
        return Math.round((f - 32) * 5 / 9 * 10);
    }

    // Helper: Convert Celsius to Celsius × 10
    protected celsiusTo10(c: number): number {
        return Math.round(c * 10);
    }

    // Helper: Convert m/s to knots × 10
    protected msToKnots10(ms: number): number {
        return Math.round(ms * 1.94384 * 10);
    }

    // Helper: Convert km/h to knots × 10
    protected kmhToKnots10(kmh: number): number {
        return Math.round(kmh * 0.539957 * 10);
    }

    // Helper: Convert mph to knots × 10
    protected mphToKnots10(mph: number): number {
        return Math.round(mph * 0.868976 * 10);
    }

    // Helper: Convert knots to knots × 10
    protected knotsTo10(knots: number): number {
        return Math.round(knots * 10);
    }

    // Helper: Convert mm to mm × 10
    protected mmTo10(mm: number): number {
        return Math.round(mm * 10);
    }

    // Helper: Convert inches to mm × 10
    protected inchesToMm10(inches: number): number {
        return Math.round(inches * 25.4 * 10);
    }

    // Helper: Convert miles to meters
    protected milesToMeters(miles: number): number {
        return Math.round(miles * 1609.34);
    }

    // Helper: Map weather description to condition code
    protected mapCondition(description: string): WeatherCondition {
        const lower = description.toLowerCase();

        if (lower.includes('storm') || lower.includes('thunder') || lower.includes('lightning')) {
            return WeatherCondition.STORM;
        }
        if (lower.includes('snow') || lower.includes('blizzard') || lower.includes('sleet')) {
            return WeatherCondition.SNOW;
        }
        if (lower.includes('rain') || lower.includes('drizzle') || lower.includes('shower')) {
            return WeatherCondition.RAIN;
        }
        if (lower.includes('fog') || lower.includes('mist') || lower.includes('haze')) {
            return WeatherCondition.FOG;
        }
        if (lower.includes('cloud') || lower.includes('overcast') || lower.includes('broken')) {
            return WeatherCondition.CLOUDY;
        }
        if (lower.includes('clear') || lower.includes('sunny') || lower.includes('fair')) {
            return WeatherCondition.CLEAR;
        }

        // Default to cloudy if unknown
        return WeatherCondition.CLOUDY;
    }

    // Helper: Create timestamp
    protected now(): number {
        return Math.floor(Date.now() / 1000);
    }
}
