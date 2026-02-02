import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { WeatherData } from '../types';

export function useWeather(locationId: number | undefined, date?: string) {
    return useQuery({
        queryKey: ['weather', locationId, date],
        queryFn: () => api.getWeather(locationId!, date),
        enabled: locationId !== undefined,
        refetchInterval: 60_000, // Refresh weather every minute
    });
}

export function useWeatherByCode(code: string | undefined, date?: string) {
    return useQuery({
        queryKey: ['weather-code', code, date],
        queryFn: () => api.getWeatherByCode(code!, date),
        enabled: !!code,
        refetchInterval: 60_000,
    });
}

export function useCurrentWeather(locationId: number | undefined) {
    return useQuery({
        queryKey: ['current-weather', locationId],
        queryFn: () => api.getWeather(locationId!),
        enabled: locationId !== undefined,
        refetchInterval: 30_000, // Current weather refreshes more frequently
    });
}

export function useMultipleWeather(locationIds: number[]) {
    return useQuery({
        queryKey: ['multiple-weather', locationIds],
        queryFn: async () => {
            const results = await Promise.all(
                locationIds.map((id) => api.getWeather(id).catch(() => null))
            );
            return results.filter((w): w is WeatherData => w !== null);
        },
        enabled: locationIds.length > 0,
        refetchInterval: 60_000,
    });
}
