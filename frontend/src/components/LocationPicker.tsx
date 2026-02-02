import { useState, useMemo } from 'react';
import type { Location } from '../types';
import { LOCATIONS, LOCATIONS_BY_CODE } from '../data/locations';
import { useFavoritesStore } from '../store/favorites';
import { useGeolocation } from '../hooks/useGeolocation';
import './LocationPicker.css';

interface LocationPickerProps {
    selectedLocation?: Location;
    onSelect: (location: Location) => void;
    filterType?: 'airport' | 'city' | 'all';
    filterRegion?: string;
    placeholder?: string;
}

function LocationPicker({
    selectedLocation,
    onSelect,
    filterType = 'all',
    filterRegion,
    placeholder = 'Search locations...',
}: LocationPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'airports' | 'cities'>('all');

    const { favoriteLocations, toggleFavorite, isFavorite } = useFavoritesStore();
    const { getNearestLocation, loading: geoLoading, error: geoError, isSupported: geoSupported } = useGeolocation();

    const handleUseMyLocation = async () => {
        const nearest = await getNearestLocation();
        if (nearest) {
            onSelect(nearest);
            setIsOpen(false);
            setSearchQuery('');
        }
    };

    const favoriteLocationObjects = useMemo(() => {
        return favoriteLocations
            .map((code) => LOCATIONS_BY_CODE[code])
            .filter((loc): loc is Location => loc !== undefined);
    }, [favoriteLocations]);

    const filteredLocations = useMemo(() => {
        let locations = LOCATIONS;

        // Filter by type based on tab
        if (activeTab === 'airports') {
            locations = locations.filter((l) => l.type === 'airport');
        } else if (activeTab === 'cities') {
            locations = locations.filter((l) => l.type === 'city');
        } else if (filterType !== 'all') {
            locations = locations.filter((l) => l.type === filterType);
        }

        // Filter by region
        if (filterRegion) {
            locations = locations.filter((l) => l.region === filterRegion);
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            locations = locations.filter(
                (l) =>
                    l.name.toLowerCase().includes(query) ||
                    l.code.toLowerCase().includes(query) ||
                    l.country.toLowerCase().includes(query)
            );
        }

        return locations;
    }, [activeTab, filterType, filterRegion, searchQuery]);

    const groupedLocations = useMemo(() => {
        const groups: Record<string, Location[]> = {};
        filteredLocations.forEach((loc) => {
            const region = loc.region || 'Other';
            if (!groups[region]) {
                groups[region] = [];
            }
            groups[region].push(loc);
        });
        return groups;
    }, [filteredLocations]);

    const handleSelect = (location: Location) => {
        onSelect(location);
        setIsOpen(false);
        setSearchQuery('');
    };

    return (
        <div className="location-picker">
            <button
                className="picker-trigger glass-panel"
                onClick={() => setIsOpen(!isOpen)}
            >
                {selectedLocation ? (
                    <div className="selected-location">
                        <span className="location-code text-mono">
                            {selectedLocation.code}
                        </span>
                        <span className="location-name">{selectedLocation.name}</span>
                        {selectedLocation.type === 'airport' && (
                            <span className="location-badge airport">Airport</span>
                        )}
                    </div>
                ) : (
                    <span className="placeholder text-hint">{placeholder}</span>
                )}
                <span className="picker-arrow">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
                <div className="picker-dropdown glass-panel">
                    <div className="picker-header">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search by name, code, or country..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                        {geoSupported && (
                            <button
                                className="geolocation-btn"
                                onClick={handleUseMyLocation}
                                disabled={geoLoading}
                                title="Use my location"
                            >
                                {geoLoading ? (
                                    <span className="geo-loading"></span>
                                ) : (
                                    <span className="geo-icon">📍</span>
                                )}
                            </button>
                        )}
                    </div>
                    {geoError && (
                        <div className="geo-error text-xs">{geoError}</div>
                    )}

                    <div className="picker-tabs">
                        <button
                            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                            onClick={() => setActiveTab('all')}
                        >
                            All
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'airports' ? 'active' : ''}`}
                            onClick={() => setActiveTab('airports')}
                        >
                            Airports
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'cities' ? 'active' : ''}`}
                            onClick={() => setActiveTab('cities')}
                        >
                            Cities
                        </button>
                    </div>

                    <div className="picker-list">
                        {favoriteLocationObjects.length > 0 && !searchQuery && (
                            <div className="location-group favorites-group">
                                <div className="group-header text-hint text-xs">
                                    <span className="favorite-star">★</span> Favorites
                                </div>
                                {favoriteLocationObjects.map((location) => (
                                    <button
                                        key={`fav-${location.id}`}
                                        className={`location-option ${
                                            selectedLocation?.id === location.id ? 'selected' : ''
                                        }`}
                                        onClick={() => handleSelect(location)}
                                    >
                                        <div className="option-left">
                                            <span className="option-code text-mono">
                                                {location.code}
                                            </span>
                                            <span className="option-name">{location.name}</span>
                                        </div>
                                        <div className="option-right">
                                            <button
                                                className="favorite-btn active"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleFavorite(location.code);
                                                }}
                                                title="Remove from favorites"
                                            >
                                                ★
                                            </button>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {Object.entries(groupedLocations).map(([region, locations]) => (
                            <div key={region} className="location-group">
                                <div className="group-header text-hint text-xs">
                                    {region}
                                </div>
                                {locations.map((location) => (
                                    <button
                                        key={location.id}
                                        className={`location-option ${
                                            selectedLocation?.id === location.id ? 'selected' : ''
                                        }`}
                                        onClick={() => handleSelect(location)}
                                    >
                                        <div className="option-left">
                                            <span className="option-code text-mono">
                                                {location.code}
                                            </span>
                                            <span className="option-name">{location.name}</span>
                                        </div>
                                        <div className="option-right">
                                            <span className="option-country text-hint text-xs">
                                                {location.country}
                                            </span>
                                            {location.type === 'airport' && (
                                                <span className="type-indicator airport-indicator"></span>
                                            )}
                                            <button
                                                className={`favorite-btn ${isFavorite(location.code) ? 'active' : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleFavorite(location.code);
                                                }}
                                                title={isFavorite(location.code) ? 'Remove from favorites' : 'Add to favorites'}
                                            >
                                                {isFavorite(location.code) ? '★' : '☆'}
                                            </button>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ))}

                        {filteredLocations.length === 0 && (
                            <div className="no-results text-hint">
                                No locations found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default LocationPicker;
