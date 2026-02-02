import type { WeatherData } from '../types';
import {
    formatTemperatureFromCelsius,
    formatWindSpeed,
    formatWindDirection,
    formatHumidity,
    formatPressure,
    formatVisibility,
    formatPrecipitation,
} from '../utils/format';
import { useSettingsStore } from '../store/settings';
import './WeatherMetrics.css';

interface WeatherMetricsProps {
    weather: WeatherData;
    showAll?: boolean;
}

interface MetricItemProps {
    icon: string;
    label: string;
    value: string;
    subValue?: string;
}

function MetricItem({ icon, label, value, subValue }: MetricItemProps) {
    return (
        <div className="weather-metric-item glass-panel">
            <div className="metric-header">
                <span className="metric-icon">{icon}</span>
                <span className="metric-label text-hint">{label}</span>
            </div>
            <div className="metric-body">
                <span className="metric-value text-mono">{value}</span>
                {subValue && (
                    <span className="metric-sub-value text-hint">{subValue}</span>
                )}
            </div>
        </div>
    );
}

function WeatherMetrics({ weather, showAll = false }: WeatherMetricsProps) {
    const { temperatureUnit } = useSettingsStore();
    const metrics = [
        {
            icon: '🌡️',
            label: 'Temperature',
            value: formatTemperatureFromCelsius(weather.temperature, temperatureUnit),
            subValue: `H: ${formatTemperatureFromCelsius(weather.temperatureMax, temperatureUnit)} L: ${formatTemperatureFromCelsius(weather.temperatureMin, temperatureUnit)}`,
        },
        {
            icon: '💨',
            label: 'Wind',
            value: formatWindSpeed(weather.windSpeed),
            subValue: formatWindDirection(weather.windDirection),
        },
        {
            icon: '💧',
            label: 'Humidity',
            value: formatHumidity(weather.humidity),
        },
        {
            icon: '🌧️',
            label: 'Precipitation',
            value: formatPrecipitation(weather.precipitation),
        },
    ];

    if (showAll) {
        metrics.push(
            {
                icon: '📊',
                label: 'Pressure',
                value: formatPressure(weather.pressure),
            },
            {
                icon: '👁️',
                label: 'Visibility',
                value: formatVisibility(weather.visibility),
            }
        );

        if (weather.windGust !== undefined) {
            metrics.push({
                icon: '🌀',
                label: 'Wind Gust',
                value: formatWindSpeed(weather.windGust),
            });
        }
    }

    return (
        <div className="weather-metrics-grid">
            {metrics.map((metric, index) => (
                <MetricItem
                    key={index}
                    icon={metric.icon}
                    label={metric.label}
                    value={metric.value}
                    subValue={metric.subValue}
                />
            ))}
        </div>
    );
}

export default WeatherMetrics;
