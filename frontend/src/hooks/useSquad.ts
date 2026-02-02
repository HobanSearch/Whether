import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export function useSquads(params?: { region?: string; limit?: number }) {
    return useQuery({
        queryKey: ['squads', params],
        queryFn: () => api.getSquads(params),
        refetchInterval: 60_000,
    });
}

export function useSquad(squadId: string | undefined) {
    return useQuery({
        queryKey: ['squad', squadId],
        queryFn: () => api.getSquad(squadId!),
        enabled: !!squadId,
        refetchInterval: 30_000,
    });
}

export function useSquadByCode(code: string | undefined) {
    return useQuery({
        queryKey: ['squad-code', code],
        queryFn: () => api.getSquadByCode(code!),
        enabled: !!code,
        staleTime: 60_000,
    });
}

export function useSearchSquads(query: string, limit: number = 10) {
    return useQuery({
        queryKey: ['squad-search', query, limit],
        queryFn: () => api.searchSquads(query, limit),
        enabled: query.length >= 1,
        staleTime: 30_000,
    });
}

export function useSquadLeaderboard(period: string = 'weekly', limit: number = 50) {
    return useQuery({
        queryKey: ['squad-leaderboard', period, limit],
        queryFn: () => api.getSquadLeaderboard(period, limit),
        refetchInterval: 60_000,
    });
}

export function useSquadRegions() {
    return useQuery({
        queryKey: ['squad-regions'],
        queryFn: api.getSquadRegions,
        staleTime: 5 * 60_000, // Regions rarely change
    });
}

export function useCreateSquad() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { name: string; code: string; region?: string }) =>
            api.createSquad(params.name, params.code, params.region),
        onSuccess: (result) => {
            if (result.success && result.squad) {
                queryClient.invalidateQueries({ queryKey: ['squads'] });
                queryClient.setQueryData(['squad', result.squad.id], result.squad);
            }
        },
    });
}
