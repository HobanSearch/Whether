import { useState, useEffect, useCallback } from 'react';
import { useMultipleWeather } from '../hooks';
import { formatTemperatureFromCelsius } from '../utils/format';
import { useSettingsStore } from '../store/settings';
import './ForecastCarousel.css';

interface ForecastLocation {
    code: string;
    label: string;
    locationId: number;
    region: string;
}

// Global coverage: North America, Europe, Asia, Middle East, Oceania, South America, Africa
const CAROUSEL_LOCATIONS: ForecastLocation[] = [
    // North America - Airports
    { code: 'KJFK', label: 'JFK', locationId: 1001, region: 'NA' },
    { code: 'KLAX', label: 'LAX', locationId: 1002, region: 'NA' },
    { code: 'KORD', label: 'ORD', locationId: 1003, region: 'NA' },
    { code: 'KMIA', label: 'MIA', locationId: 1004, region: 'NA' },
    { code: 'CYYZ', label: 'YYZ', locationId: 1005, region: 'NA' },

    // Europe - Airports
    { code: 'EGLL', label: 'LHR', locationId: 1010, region: 'EU' },
    { code: 'LFPG', label: 'CDG', locationId: 1011, region: 'EU' },
    { code: 'EDDF', label: 'FRA', locationId: 1012, region: 'EU' },
    { code: 'EHAM', label: 'AMS', locationId: 1013, region: 'EU' },
    { code: 'LEMD', label: 'MAD', locationId: 1014, region: 'EU' },

    // Asia - Airports
    { code: 'RJTT', label: 'HND', locationId: 1020, region: 'AS' },
    { code: 'WSSS', label: 'SIN', locationId: 1022, region: 'AS' },
    { code: 'VHHH', label: 'HKG', locationId: 1023, region: 'AS' },
    { code: 'RKSI', label: 'ICN', locationId: 1024, region: 'AS' },

    // Middle East - Airports
    { code: 'OMDB', label: 'DXB', locationId: 1030, region: 'ME' },
    { code: 'OTHH', label: 'DOH', locationId: 1031, region: 'ME' },

    // Oceania - Airports
    { code: 'YSSY', label: 'SYD', locationId: 1040, region: 'OC' },
    { code: 'YMML', label: 'MEL', locationId: 1041, region: 'OC' },

    // Major Cities
    { code: 'NYC', label: 'NYC', locationId: 2001, region: 'NA' },
    { code: 'LON', label: 'LON', locationId: 2010, region: 'EU' },
    { code: 'TKY', label: 'TKY', locationId: 2020, region: 'AS' },
    { code: 'DXB', label: 'DXB', locationId: 2030, region: 'ME' },
    { code: 'SYD', label: 'SYD', locationId: 2060, region: 'OC' },
    { code: 'SAO', label: 'SAO', locationId: 2040, region: 'SA' },
    { code: 'CAI', label: 'CAI', locationId: 2051, region: 'AF' },
];

const ROTATION_INTERVAL = 3000; // 3 seconds per location for faster global coverage

function ForecastCarousel() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const { temperatureUnit } = useSettingsStore();

    const locationIds = CAROUSEL_LOCATIONS.map(loc => loc.locationId);
    const { data: weatherData } = useMultipleWeather(locationIds);

    // Auto-rotate carousel
    useEffect(() => {
        if (isPaused) return;

        const interval = setInterval(() => {
            setIsAnimating(true);
            setTimeout(() => {
                setCurrentIndex((prev) => (prev + 1) % CAROUSEL_LOCATIONS.length);
                setIsAnimating(false);
            }, 300);
        }, ROTATION_INTERVAL);

        return () => clearInterval(interval);
    }, [isPaused]);

    // Manual navigation
    const goToIndex = useCallback((index: number) => {
        if (index === currentIndex) return;
        setIsAnimating(true);
        setTimeout(() => {
            setCurrentIndex(index);
            setIsAnimating(false);
        }, 200);
    }, [currentIndex]);

    const handlePrevious = useCallback(() => {
        const newIndex = (currentIndex - 1 + CAROUSEL_LOCATIONS.length) % CAROUSEL_LOCATIONS.length;
        goToIndex(newIndex);
    }, [currentIndex, goToIndex]);

    const handleNext = useCallback(() => {
        const newIndex = (currentIndex + 1) % CAROUSEL_LOCATIONS.length;
        goToIndex(newIndex);
    }, [currentIndex, goToIndex]);

    const currentLocation = CAROUSEL_LOCATIONS[currentIndex];
    const currentWeather = weatherData?.find(w => w.locationId === currentLocation.locationId);
    const temperature = currentWeather ? formatTemperatureFromCelsius(currentWeather.temperature, temperatureUnit) : '--°';

    // Region labels for display
    const regionLabels: Record<string, string> = {
        'NA': '🌎',
        'EU': '🌍',
        'AS': '🌏',
        'ME': '🏜️',
        'OC': '🌊',
        'SA': '🌎',
        'AF': '🌍',
    };

    return (
        <div
            className="forecast-carousel"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
        >
            <button
                className="carousel-nav-btn prev"
                onClick={handlePrevious}
                aria-label="Previous location"
            >
                <span className="nav-arrow">&lt;</span>
            </button>

            <div className={`carousel-content ${isAnimating ? 'animating' : ''}`}>
                <span className="region-indicator">{regionLabels[currentLocation.region]}</span>
                <span className="temp-value">{temperature}</span>
                <span className="location-label">{currentLocation.label}</span>
            </div>

            <button
                className="carousel-nav-btn next"
                onClick={handleNext}
                aria-label="Next location"
            >
                <span className="nav-arrow">&gt;</span>
            </button>

            <div className="carousel-progress">
                <div
                    className="carousel-progress-bar"
                    style={{ width: `${((currentIndex + 1) / CAROUSEL_LOCATIONS.length) * 100}%` }}
                />
            </div>
        </div>
    );
}

export default ForecastCarousel;
