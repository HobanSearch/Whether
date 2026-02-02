import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export function useLocations(params?: { type?: string; region?: string }) {
    return useQuery({
        queryKey: ['locations', params],
        queryFn: () => api.getLocations(params),
        staleTime: 5 * 60 * 1000, // Locations rarely change, cache for 5 minutes
    });
}

export function useLocation(locationId: number | undefined) {
    return useQuery({
        queryKey: ['location', locationId],
        queryFn: () => api.getLocation(locationId!),
        enabled: locationId !== undefined,
        staleTime: 5 * 60 * 1000,
    });
}

export function useAirports() {
    return useQuery({
        queryKey: ['airports'],
        queryFn: api.getAirports,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCities() {
    return useQuery({
        queryKey: ['cities'],
        queryFn: api.getCities,
        staleTime: 5 * 60 * 1000,
    });
}

export function useRegions() {
    return useQuery({
        queryKey: ['regions'],
        queryFn: api.getRegions,
        staleTime: 5 * 60 * 1000,
    });
}
