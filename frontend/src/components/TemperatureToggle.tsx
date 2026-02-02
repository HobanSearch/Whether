import { useSettingsStore, TemperatureUnit } from '../store/settings';
import './TemperatureToggle.css';

interface TemperatureToggleProps {
    size?: 'sm' | 'md';
}

function TemperatureToggle({ size = 'md' }: TemperatureToggleProps) {
    const { temperatureUnit, setTemperatureUnit } = useSettingsStore();

    const handleToggle = (unit: TemperatureUnit) => {
        setTemperatureUnit(unit);
    };

    return (
        <div className={`temp-toggle temp-toggle-${size}`}>
            <button
                className={`temp-toggle-btn ${temperatureUnit === 'C' ? 'active' : ''}`}
                onClick={() => handleToggle('C')}
                aria-pressed={temperatureUnit === 'C'}
            >
                °C
            </button>
            <button
                className={`temp-toggle-btn ${temperatureUnit === 'F' ? 'active' : ''}`}
                onClick={() => handleToggle('F')}
                aria-pressed={temperatureUnit === 'F'}
            >
                °F
            </button>
        </div>
    );
}

export default TemperatureToggle;
