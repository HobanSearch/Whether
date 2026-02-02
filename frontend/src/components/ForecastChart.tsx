import type { Forecast } from '../types';
import { formatTemperatureFromCelsius } from '../utils/format';
import { useSettingsStore } from '../store/settings';
import './ForecastChart.css';

interface ForecastChartProps {
    forecast: Forecast;
    threshold?: number;
    showDistribution?: boolean;
}

function ForecastChart({ forecast, threshold, showDistribution = true }: ForecastChartProps) {
    const { temperatureUnit } = useSettingsStore();
    const { distribution, pointForecast } = forecast;

    // Calculate chart bounds
    const allValues = [
        distribution.p10,
        distribution.p25,
        distribution.p50,
        distribution.p75,
        distribution.p90,
    ];
    if (threshold !== undefined) {
        allValues.push(threshold);
    }

    const minValue = Math.min(...allValues) - 5;
    const maxValue = Math.max(...allValues) + 5;
    const range = maxValue - minValue;

    const getPosition = (value: number) => {
        return ((value - minValue) / range) * 100;
    };

    const p10Pos = getPosition(distribution.p10);
    const p25Pos = getPosition(distribution.p25);
    const p50Pos = getPosition(distribution.p50);
    const p75Pos = getPosition(distribution.p75);
    const p90Pos = getPosition(distribution.p90);
    const thresholdPos = threshold !== undefined ? getPosition(threshold) : undefined;

    // Determine if threshold is likely to be exceeded
    const thresholdProbability = threshold !== undefined
        ? calculateThresholdProbability(distribution, threshold)
        : undefined;

    return (
        <div className="forecast-chart">
            <div className="chart-header">
                <div className="chart-title">
                    <span className="title-text">Temperature Forecast</span>
                    <span className="forecast-date text-hint">{forecast.date}</span>
                </div>
                <div className="point-forecast text-mono">
                    <span className="label text-hint">Point Forecast:</span>
                    <span className="value">
                        H: {formatTemperatureFromCelsius(pointForecast.tMax, temperatureUnit)} / L: {formatTemperatureFromCelsius(pointForecast.tMin, temperatureUnit)}
                    </span>
                </div>
            </div>

            {showDistribution && (
                <div className="distribution-chart">
                    <div className="chart-track">
                        {/* 90% confidence interval (p10-p90) */}
                        <div
                            className="confidence-band ci-90"
                            style={{
                                left: `${p10Pos}%`,
                                width: `${p90Pos - p10Pos}%`,
                            }}
                        ></div>

                        {/* 50% confidence interval (p25-p75) */}
                        <div
                            className="confidence-band ci-50"
                            style={{
                                left: `${p25Pos}%`,
                                width: `${p75Pos - p25Pos}%`,
                            }}
                        ></div>

                        {/* Median marker */}
                        <div
                            className="median-marker"
                            style={{ left: `${p50Pos}%` }}
                        >
                            <div className="marker-line"></div>
                            <div className="marker-dot"></div>
                        </div>

                        {/* Threshold line */}
                        {thresholdPos !== undefined && (
                            <div
                                className="threshold-marker"
                                style={{ left: `${thresholdPos}%` }}
                            >
                                <div className="threshold-line"></div>
                                <div className="threshold-flag">
                                    <span className="threshold-value text-mono">
                                        {formatTemperatureFromCelsius(threshold!, temperatureUnit)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="chart-labels">
                        <div className="label-item" style={{ left: `${p10Pos}%` }}>
                            <span className="percentile-label text-mono text-xs">P10</span>
                            <span className="percentile-value text-mono">
                                {formatTemperatureFromCelsius(distribution.p10, temperatureUnit)}
                            </span>
                        </div>
                        <div className="label-item" style={{ left: `${p50Pos}%` }}>
                            <span className="percentile-label text-mono text-xs">P50</span>
                            <span className="percentile-value text-mono">
                                {formatTemperatureFromCelsius(distribution.p50, temperatureUnit)}
                            </span>
                        </div>
                        <div className="label-item" style={{ left: `${p90Pos}%` }}>
                            <span className="percentile-label text-mono text-xs">P90</span>
                            <span className="percentile-value text-mono">
                                {formatTemperatureFromCelsius(distribution.p90, temperatureUnit)}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {thresholdProbability !== undefined && (
                <div className="probability-section">
                    <div className="probability-bar">
                        <div
                            className="probability-fill"
                            style={{ width: `${thresholdProbability * 100}%` }}
                        ></div>
                    </div>
                    <div className="probability-label">
                        <span className="probability-value text-mono text-glow">
                            {(thresholdProbability * 100).toFixed(0)}%
                        </span>
                        <span className="probability-text text-hint">
                            chance of exceeding {formatTemperatureFromCelsius(threshold!, temperatureUnit)}
                        </span>
                    </div>
                </div>
            )}

            <div className="confidence-legend">
                <div className="legend-item">
                    <div className="legend-swatch ci-50-swatch"></div>
                    <span className="legend-text text-hint text-xs">50% confidence</span>
                </div>
                <div className="legend-item">
                    <div className="legend-swatch ci-90-swatch"></div>
                    <span className="legend-text text-hint text-xs">90% confidence</span>
                </div>
            </div>
        </div>
    );
}

function calculateThresholdProbability(
    distribution: { p10: number; p25: number; p50: number; p75: number; p90: number },
    threshold: number
): number {
    // Simple linear interpolation between percentiles
    const points = [
        { p: 0.10, v: distribution.p10 },
        { p: 0.25, v: distribution.p25 },
        { p: 0.50, v: distribution.p50 },
        { p: 0.75, v: distribution.p75 },
        { p: 0.90, v: distribution.p90 },
    ];

    // If threshold is below p10, probability > threshold is very high
    if (threshold <= distribution.p10) return 0.95;
    // If threshold is above p90, probability is very low
    if (threshold >= distribution.p90) return 0.05;

    // Find the interval containing the threshold
    for (let i = 0; i < points.length - 1; i++) {
        if (threshold >= points[i].v && threshold <= points[i + 1].v) {
            const fraction = (threshold - points[i].v) / (points[i + 1].v - points[i].v);
            const pAtThreshold = points[i].p + fraction * (points[i + 1].p - points[i].p);
            return 1 - pAtThreshold;
        }
    }

    return 0.5;
}

export default ForecastChart;
