import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Forecast } from '../types';

export function useForecast(location: string | undefined, date?: string) {
    return useQuery({
        queryKey: ['forecast', location, date],
        queryFn: () => api.getForecast(location!, date),
        enabled: !!location,
        refetchInterval: 5 * 60_000, // Forecasts update every 5 minutes
    });
}

export function useForecastRange(location: string | undefined, dates: string[]) {
    return useQuery({
        queryKey: ['forecast-range', location, dates],
        queryFn: async () => {
            const results = await Promise.all(
                dates.map((date) =>
                    api.getForecast(location!, date).catch(() => null)
                )
            );
            return results.filter((f): f is Forecast => f !== null);
        },
        enabled: !!location && dates.length > 0,
        refetchInterval: 5 * 60_000,
    });
}

export function useMultiLocationForecast(locations: string[], date?: string) {
    return useQuery({
        queryKey: ['multi-location-forecast', locations, date],
        queryFn: async () => {
            const results = await Promise.all(
                locations.map((loc) =>
                    api.getForecast(loc, date).catch(() => null)
                )
            );
            return results.filter((f): f is Forecast => f !== null);
        },
        enabled: locations.length > 0,
        refetchInterval: 5 * 60_000,
    });
}
