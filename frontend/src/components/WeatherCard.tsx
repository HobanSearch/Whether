import type { WeatherData, Location } from '../types';
import {
    formatTemperatureFromCelsius,
    formatWindSpeed,
    formatWindDirection,
    formatHumidity,
    getWeatherConditionLabel,
    getWeatherIcon,
} from '../utils/format';
import { useSettingsStore } from '../store/settings';
import './WeatherCard.css';

/* Add specific styles for the new image icons */
/* Note: Since we don't have write access to WeatherCard.css right here, we'll inline some styles or assume the existing classes work. 
   But "weather-icon-sm" and "weather-icon-large" were likely spans previously. 
   We should check WeatherCard.css or adding a style block here 
   Wait, I can edit WeatherCard.css. I will verify it first. */

interface WeatherCardProps {
    weather: WeatherData;
    location?: Location;
    compact?: boolean;
}

function WeatherCard({ weather, location, compact = false }: WeatherCardProps) {
    const { temperatureUnit } = useSettingsStore();
    const iconPath = getWeatherIcon(weather.conditions);
    const conditionLabel = getWeatherConditionLabel(weather.conditions);

    if (compact) {
        return (
            <div className="weather-card-compact glass-panel">
                <div className="weather-compact-left">
                    <img src={iconPath} alt={weather.conditions} className="weather-icon-sm" />
                    <span className="weather-temp-sm text-mono text-glow">
                        {formatTemperatureFromCelsius(weather.temperature, temperatureUnit)}
                    </span>
                </div>
                {location && (
                    <span className="weather-location-sm text-hint">{location.name}</span>
                )}
            </div>
        );
    }

    return (
        <div className="weather-card glass-panel">
            <div className="weather-header">
                {location && (
                    <div className="weather-location">
                        <span className="location-code text-mono">{location.code}</span>
                        <span className="location-name">{location.name}</span>
                    </div>
                )}
                <div className="weather-date text-hint text-sm">
                    {weather.observationDate}
                </div>
            </div>

            <div className="weather-main">
                <img src={iconPath} alt={weather.conditions} className="weather-icon-large" />
                <div className="weather-temp-container">
                    <span className="weather-temp-main text-mono text-glow">
                        {formatTemperatureFromCelsius(weather.temperature, temperatureUnit)}
                    </span>
                    <span className="weather-condition">{conditionLabel}</span>
                </div>
            </div>

            <div className="weather-range">
                <div className="temp-range-item">
                    <span className="range-label text-hint">High</span>
                    <span className="range-value text-mono">
                        {formatTemperatureFromCelsius(weather.temperatureMax, temperatureUnit)}
                    </span>
                </div>
                <div className="temp-range-divider"></div>
                <div className="temp-range-item">
                    <span className="range-label text-hint">Low</span>
                    <span className="range-value text-mono">
                        {formatTemperatureFromCelsius(weather.temperatureMin, temperatureUnit)}
                    </span>
                </div>
            </div>

            <div className="weather-metrics-row">
                <div className="metric-item">
                    <img src="/assets/weather/wind.png" alt="Wind" className="metric-icon-img" />
                    <span className="metric-value text-mono">
                        {formatWindSpeed(weather.windSpeed)}
                    </span>
                    <span className="metric-label text-hint">
                        {formatWindDirection(weather.windDirection)}
                    </span>
                </div>
                <div className="metric-item">
                    <img src="/assets/weather/humidity.png" alt="Humidity" className="metric-icon-img" />
                    <span className="metric-value text-mono">
                        {formatHumidity(weather.humidity)}
                    </span>
                    <span className="metric-label text-hint">Humidity</span>
                </div>
            </div>
        </div>
    );
}

export default WeatherCard;
