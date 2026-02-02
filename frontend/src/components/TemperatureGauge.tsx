import { formatTemperatureFromCelsius, celsiusToFahrenheit } from '../utils/format';
import { useSettingsStore } from '../store/settings';
import './TemperatureGauge.css';

interface TemperatureGaugeProps {
    current: number;
    low?: number;
    high?: number;
    threshold?: number;
    label?: string;
    size?: 'sm' | 'md' | 'lg';
}

function TemperatureGauge({
    current,
    low,
    high,
    threshold,
    label,
    size = 'md',
}: TemperatureGaugeProps) {
    const { temperatureUnit } = useSettingsStore();

    // Internal calculations always use Fahrenheit for gauge positioning
    const currentF = celsiusToFahrenheit(current);
    const lowF = low !== undefined ? celsiusToFahrenheit(low) : undefined;
    const highF = high !== undefined ? celsiusToFahrenheit(high) : undefined;
    const thresholdF = threshold !== undefined ? celsiusToFahrenheit(threshold) : undefined;

    // Calculate position on gauge if we have range
    const getPosition = (temp: number) => {
        if (lowF === undefined || highF === undefined) return 50;
        const range = highF - lowF;
        if (range === 0) return 50;
        return Math.max(0, Math.min(100, ((temp - lowF) / range) * 100));
    };

    const currentPosition = getPosition(currentF);
    const thresholdPosition = thresholdF !== undefined ? getPosition(thresholdF) : undefined;

    // Determine color based on temperature
    const getTemperatureColor = (tempF: number) => {
        if (tempF <= 32) return 'var(--color-primary-cyan)';
        if (tempF <= 50) return '#4DB8FF';
        if (tempF <= 70) return 'var(--color-success-matrix)';
        if (tempF <= 85) return 'var(--color-warning)';
        return 'var(--color-secondary-orange)';
    };

    const tempColor = getTemperatureColor(currentF);

    return (
        <div className={`temperature-gauge gauge-${size}`}>
            {label && <div className="gauge-label text-hint">{label}</div>}

            <div className="gauge-value-container">
                <span
                    className="gauge-value text-mono text-glow"
                    style={{ color: tempColor }}
                >
                    {formatTemperatureFromCelsius(current, temperatureUnit)}
                </span>
            </div>

            {(lowF !== undefined && highF !== undefined) && (
                <div className="gauge-track">
                    <div className="gauge-track-bg"></div>
                    <div
                        className="gauge-indicator"
                        style={{ left: `${currentPosition}%` }}
                    >
                        <div
                            className="gauge-dot"
                            style={{ backgroundColor: tempColor, boxShadow: `0 0 10px ${tempColor}` }}
                        ></div>
                    </div>
                    {thresholdPosition !== undefined && (
                        <div
                            className="gauge-threshold"
                            style={{ left: `${thresholdPosition}%` }}
                        >
                            <div className="threshold-line"></div>
                            <span className="threshold-label text-mono text-xs">
                                {formatTemperatureFromCelsius(threshold!, temperatureUnit)}
                            </span>
                        </div>
                    )}
                    <div className="gauge-range">
                        <span className="range-min text-mono text-hint">
                            {formatTemperatureFromCelsius(low!, temperatureUnit)}
                        </span>
                        <span className="range-max text-mono text-hint">
                            {formatTemperatureFromCelsius(high!, temperatureUnit)}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TemperatureGauge;
