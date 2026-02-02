import { useState, useEffect } from 'react';
import { useWeather, useForecast } from '../hooks';
import { LOCATIONS, LOCATIONS_BY_CODE } from '../data/locations';
import { useFavoritesStore } from '../store/favorites';
import type { Location } from '../types';
import WeatherCard from '../components/WeatherCard';
import ForecastChart from '../components/ForecastChart';
import WeatherMetrics from '../components/WeatherMetrics';
import LocationPicker from '../components/LocationPicker';
import './ForecastPage.css';

function ForecastPage() {
    const { favoriteLocations } = useFavoritesStore();

    const getInitialLocation = (): Location => {
        if (favoriteLocations.length > 0) {
            const firstFavorite = LOCATIONS_BY_CODE[favoriteLocations[0]];
            if (firstFavorite) {
                return firstFavorite;
            }
        }
        return LOCATIONS[0];
    };

    const [selectedLocation, setSelectedLocation] = useState<Location>(getInitialLocation);
    const [selectedDate, setSelectedDate] = useState<string | undefined>();
    const [hasInitialized, setHasInitialized] = useState(false);

    useEffect(() => {
        if (!hasInitialized && favoriteLocations.length > 0) {
            const firstFavorite = LOCATIONS_BY_CODE[favoriteLocations[0]];
            if (firstFavorite) {
                setSelectedLocation(firstFavorite);
            }
            setHasInitialized(true);
        }
    }, [favoriteLocations, hasInitialized]);

    const { data: weather, isLoading: weatherLoading } = useWeather(selectedLocation.id);
    const { data: forecast, isLoading: forecastLoading } = useForecast(
        selectedLocation.code,
        selectedDate
    );

    const isLoading = weatherLoading || forecastLoading;

    // Generate next 7 days for date picker
    const dateOptions = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        return {
            value: date.toISOString().split('T')[0],
            label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        };
    });

    return (
        <div className="container forecast-page">
            <section className="location-section">
                <h2 className="page-title">Weather Forecast</h2>
                <LocationPicker
                    selectedLocation={selectedLocation}
                    onSelect={setSelectedLocation}
                    placeholder="Select a location"
                />
            </section>

            <section className="date-section">
                <div className="date-picker">
                    {dateOptions.map((option) => (
                        <button
                            key={option.value}
                            className={`date-btn ${(!selectedDate && option.value === dateOptions[0].value) || selectedDate === option.value ? 'active' : ''}`}
                            onClick={() => setSelectedDate(option.value === dateOptions[0].value ? undefined : option.value)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </section>

            {isLoading ? (
                <div className="loading">
                    <div className="loading-spinner" />
                </div>
            ) : (
                <>
                    {weather && (
                        <section className="current-weather-section">
                            <h3 className="section-title">Current Conditions</h3>
                            <WeatherCard weather={weather} location={selectedLocation} />
                        </section>
                    )}

                    {forecast && (
                        <section className="forecast-section">
                            <h3 className="section-title">Probabilistic Forecast</h3>
                            <div className="glass-panel">
                                <ForecastChart forecast={forecast} showDistribution={true} />
                            </div>
                        </section>
                    )}

                    {weather && (
                        <section className="metrics-section">
                            <h3 className="section-title">Detailed Metrics</h3>
                            <WeatherMetrics weather={weather} showAll={true} />
                        </section>
                    )}
                </>
            )}

            <section className="market-prompt-section">
                <div className="market-prompt glass-panel">
                    <h4>Trade on this forecast</h4>
                    <p className="text-hint">
                        Find markets based on {selectedLocation.name}'s weather
                    </p>
                    <a
                        href={`/markets?location=${selectedLocation.code}`}
                        className="btn btn-primary btn-full"
                    >
                        View Markets
                    </a>
                </div>
            </section>
        </div>
    );
}

export default ForecastPage;
