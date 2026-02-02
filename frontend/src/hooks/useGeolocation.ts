import { useState, useCallback } from 'react';
import { LOCATIONS } from '../data/locations';
import type { Location } from '../types';

interface GeolocationState {
    loading: boolean;
    error: string | null;
    position: GeolocationPosition | null;
}

interface UseGeolocationReturn extends GeolocationState {
    getNearestLocation: () => Promise<Location | null>;
    isSupported: boolean;
}

function calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function findNearestLocation(lat: number, lon: number): Location {
    let nearestLocation = LOCATIONS[0];
    let shortestDistance = Infinity;

    for (const location of LOCATIONS) {
        const distance = calculateHaversineDistance(
            lat,
            lon,
            location.coordinates.lat,
            location.coordinates.lon
        );
        if (distance < shortestDistance) {
            shortestDistance = distance;
            nearestLocation = location;
        }
    }

    return nearestLocation;
}

export function useGeolocation(): UseGeolocationReturn {
    const [state, setState] = useState<GeolocationState>({
        loading: false,
        error: null,
        position: null,
    });

    const isSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

    const getNearestLocation = useCallback((): Promise<Location | null> => {
        return new Promise((resolve) => {
            if (!isSupported) {
                setState((prev) => ({
                    ...prev,
                    error: 'Geolocation is not supported by your browser',
                }));
                resolve(null);
                return;
            }

            setState((prev) => ({ ...prev, loading: true, error: null }));

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setState({
                        loading: false,
                        error: null,
                        position,
                    });

                    const nearestLocation = findNearestLocation(
                        position.coords.latitude,
                        position.coords.longitude
                    );
                    resolve(nearestLocation);
                },
                (error) => {
                    let errorMessage = 'Failed to get location';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = 'Location permission denied';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = 'Location information unavailable';
                            break;
                        case error.TIMEOUT:
                            errorMessage = 'Location request timed out';
                            break;
                    }
                    setState({
                        loading: false,
                        error: errorMessage,
                        position: null,
                    });
                    resolve(null);
                },
                {
                    enableHighAccuracy: false,
                    timeout: 10000,
                    maximumAge: 300000,
                }
            );
        });
    }, [isSupported]);

    return {
        ...state,
        getNearestLocation,
        isSupported,
    };
}
