/**
 * Whether Oracle Bot - Open-Meteo Source
 * Free weather data backup source (no API key required)
 */

import axios from 'axios';
import { BaseWeatherSource } from './base';
import {
    Location,
    WeatherData,
    WeatherCondition,
    OpenMeteoResponse
} from '../types';
import { SOURCE_PRIORITIES } from '../config';

export class OpenMeteoSource extends BaseWeatherSource {
    name = 'openmeteo';
    priority = SOURCE_PRIORITIES.OPENMETEO;

    private baseUrl = 'https://api.open-meteo.com/v1/forecast';

    async fetch(location: Location): Promise<WeatherData | null> {
        try {
            const response = await axios.get<OpenMeteoResponse>(this.baseUrl, {
                params: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    current_weather: true,
                    hourly: 'temperature_2m,precipitation,visibility,windspeed_10m,windgusts_10m,surface_pressure,relativehumidity_2m',
                    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
                    timezone: 'auto',
                    forecast_days: 1,
                },
                timeout: 10000,
            });

            return this.parseResponse(location, response.data, JSON.stringify(response.data));
        } catch (error) {
            console.error(`[Open-Meteo] Error fetching ${location.code}:`, error);
            return null;
        }
    }

    private parseResponse(
        location: Location,
        data: OpenMeteoResponse,
        rawData: string
    ): WeatherData {
        const current = data.current_weather;
        const hourly = data.hourly;
        const daily = data.daily;

        // Temperature (Open-Meteo returns Celsius)
        const temperature = this.celsiusTo10(current.temperature);

        // Get daily max/min if available, otherwise estimate
        let temperatureMax = temperature + 30; // Default +3°C
        let temperatureMin = temperature - 30; // Default -3°C
        if (daily?.temperature_2m_max?.[0] !== undefined) {
            temperatureMax = this.celsiusTo10(daily.temperature_2m_max[0]);
        }
        if (daily?.temperature_2m_min?.[0] !== undefined) {
            temperatureMin = this.celsiusTo10(daily.temperature_2m_min[0]);
        }

        // Wind (Open-Meteo returns km/h)
        const windSpeed = this.kmhToKnots10(current.windspeed);
        let windGust = windSpeed;

        // Get current hour index
        const currentHourIndex = this.getCurrentHourIndex(hourly?.time);

        // Get hourly values for current time if available
        if (hourly && currentHourIndex >= 0) {
            if (hourly.windgusts_10m?.[currentHourIndex] !== undefined) {
                windGust = this.kmhToKnots10(hourly.windgusts_10m[currentHourIndex]);
            }
        }

        // Visibility (from hourly data, in meters)
        let visibility = 10000;
        if (hourly?.visibility?.[currentHourIndex] !== undefined) {
            visibility = Math.round(hourly.visibility[currentHourIndex]);
        }

        // Pressure (from hourly data, in hPa)
        let pressure = 1013;
        if (hourly?.surface_pressure?.[currentHourIndex] !== undefined) {
            pressure = Math.round(hourly.surface_pressure[currentHourIndex]);
        }

        // Humidity (from hourly data)
        let humidity = 50;
        if (hourly?.relativehumidity_2m?.[currentHourIndex] !== undefined) {
            humidity = Math.round(hourly.relativehumidity_2m[currentHourIndex]);
        }

        // Precipitation (from daily sum or hourly)
        let precipitation = 0;
        if (daily?.precipitation_sum?.[0] !== undefined) {
            precipitation = this.mmTo10(daily.precipitation_sum[0]);
        } else if (hourly?.precipitation?.[currentHourIndex] !== undefined) {
            precipitation = this.mmTo10(hourly.precipitation[currentHourIndex]);
        }

        // Conditions from WMO weather code
        const conditions = this.mapWmoCode(current.weathercode);

        return {
            locationId: location.id,
            timestamp: this.now(),
            temperature,
            temperatureMax,
            temperatureMin,
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

    private getCurrentHourIndex(times?: string[]): number {
        if (!times || times.length === 0) return -1;

        const now = new Date();
        const currentHour = now.toISOString().slice(0, 13); // "2024-01-07T14"

        for (let i = 0; i < times.length; i++) {
            if (times[i].startsWith(currentHour)) {
                return i;
            }
        }

        // Return first index if current hour not found
        return 0;
    }

    // Map WMO weather codes to our condition enum
    // https://open-meteo.com/en/docs
    private mapWmoCode(code: number): WeatherCondition {
        // 0: Clear sky
        if (code === 0) return WeatherCondition.CLEAR;

        // 1-3: Mainly clear, partly cloudy, overcast
        if (code >= 1 && code <= 3) return WeatherCondition.CLOUDY;

        // 45, 48: Fog
        if (code === 45 || code === 48) return WeatherCondition.FOG;

        // 51-55: Drizzle
        if (code >= 51 && code <= 55) return WeatherCondition.RAIN;

        // 56-57: Freezing drizzle
        if (code >= 56 && code <= 57) return WeatherCondition.RAIN;

        // 61-65: Rain
        if (code >= 61 && code <= 65) return WeatherCondition.RAIN;

        // 66-67: Freezing rain
        if (code >= 66 && code <= 67) return WeatherCondition.RAIN;

        // 71-77: Snow
        if (code >= 71 && code <= 77) return WeatherCondition.SNOW;

        // 80-82: Rain showers
        if (code >= 80 && code <= 82) return WeatherCondition.RAIN;

        // 85-86: Snow showers
        if (code >= 85 && code <= 86) return WeatherCondition.SNOW;

        // 95-99: Thunderstorm
        if (code >= 95 && code <= 99) return WeatherCondition.STORM;

        return WeatherCondition.CLEAR;
    }
}
