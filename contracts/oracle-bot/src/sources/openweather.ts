/**
 * Whether Oracle Bot - OpenWeatherMap Source
 * Global weather data from OpenWeatherMap API
 */

import axios from 'axios';
import { BaseWeatherSource } from './base';
import {
    Location,
    WeatherData,
    WeatherCondition,
    OpenWeatherResponse
} from '../types';
import { SOURCE_PRIORITIES } from '../config';

export class OpenWeatherSource extends BaseWeatherSource {
    name = 'openweather';
    priority = SOURCE_PRIORITIES.OPENWEATHER;

    private apiKey: string;
    private baseUrl = 'https://api.openweathermap.org/data/2.5/weather';

    constructor(apiKey: string) {
        super();
        this.apiKey = apiKey;
    }

    async fetch(location: Location): Promise<WeatherData | null> {
        try {
            const response = await axios.get<OpenWeatherResponse>(this.baseUrl, {
                params: {
                    lat: location.latitude,
                    lon: location.longitude,
                    appid: this.apiKey,
                    units: 'metric', // Get Celsius directly
                },
                timeout: 10000,
            });

            return this.parseResponse(location, response.data, JSON.stringify(response.data));
        } catch (error) {
            console.error(`[OpenWeather] Error fetching ${location.code}:`, error);
            return null;
        }
    }

    private parseResponse(
        location: Location,
        data: OpenWeatherResponse,
        rawData: string
    ): WeatherData {
        // Temperature (already in Celsius)
        const temperature = this.celsiusTo10(data.main.temp);
        const temperatureMax = this.celsiusTo10(data.main.temp_max);
        const temperatureMin = this.celsiusTo10(data.main.temp_min);

        // Wind (OpenWeather returns m/s)
        const windSpeed = this.msToKnots10(data.wind.speed);
        const windGust = this.msToKnots10(data.wind.gust ?? data.wind.speed);

        // Visibility (OpenWeather returns meters)
        const visibility = data.visibility ?? 10000;

        // Pressure (OpenWeather returns hPa)
        const pressure = Math.round(data.main.pressure);

        // Humidity (percentage)
        const humidity = data.main.humidity;

        // Precipitation (from rain/snow if present)
        let precipitation = 0;
        if (data.rain) {
            precipitation += this.mmTo10(data.rain['1h'] ?? data.rain['3h'] ?? 0);
        }
        if (data.snow) {
            precipitation += this.mmTo10(data.snow['1h'] ?? data.snow['3h'] ?? 0);
        }

        // Conditions
        const conditions = this.mapOpenWeatherCondition(data.weather[0]?.id ?? 800);

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

    // Map OpenWeatherMap weather codes to our condition enum
    // https://openweathermap.org/weather-conditions
    private mapOpenWeatherCondition(code: number): WeatherCondition {
        // Thunderstorm (200-299)
        if (code >= 200 && code < 300) {
            return WeatherCondition.STORM;
        }

        // Drizzle (300-399)
        if (code >= 300 && code < 400) {
            return WeatherCondition.RAIN;
        }

        // Rain (500-599)
        if (code >= 500 && code < 600) {
            return WeatherCondition.RAIN;
        }

        // Snow (600-699)
        if (code >= 600 && code < 700) {
            return WeatherCondition.SNOW;
        }

        // Atmosphere (fog, mist, haze) (700-799)
        if (code >= 700 && code < 800) {
            return WeatherCondition.FOG;
        }

        // Clear (800)
        if (code === 800) {
            return WeatherCondition.CLEAR;
        }

        // Clouds (801-804)
        if (code > 800 && code < 900) {
            return WeatherCondition.CLOUDY;
        }

        return WeatherCondition.CLEAR;
    }
}
