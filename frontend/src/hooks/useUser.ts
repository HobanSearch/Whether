import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export function useUser(userId: string | undefined) {
    return useQuery({
        queryKey: ['user', userId],
        queryFn: () => api.getUser(userId!),
        enabled: !!userId,
        staleTime: 60_000,
    });
}

export function useCurrentUser(telegramId: number | undefined) {
    return useQuery({
        queryKey: ['current-user', telegramId],
        queryFn: () => api.getCurrentUser(telegramId!),
        enabled: telegramId !== undefined,
        staleTime: 30_000,
        refetchInterval: 60_000,
    });
}

export function useUserStats(userId: string | undefined) {
    return useQuery({
        queryKey: ['user-stats', userId],
        queryFn: () => api.getUserStats(userId!),
        enabled: !!userId,
        refetchInterval: 30_000,
    });
}

export function useUserLeaderboard(metric: string = 'volume', limit: number = 100) {
    return useQuery({
        queryKey: ['user-leaderboard', metric, limit],
        queryFn: () => api.getUserLeaderboard(metric, limit),
        refetchInterval: 60_000,
    });
}

export function useCreateOrUpdateUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { telegramId: number; tonAddress?: string; username?: string }) =>
            api.getOrCreateUser(params.telegramId, params.tonAddress, params.username),
        onSuccess: (user) => {
            queryClient.setQueryData(['current-user', user.telegramId], user);
            queryClient.setQueryData(['user', user.id], user);
        },
    });
}

export function useApplyReferral() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { userId: string; referralCode: string }) =>
            api.applyReferral(params.userId, params.referralCode),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['user', variables.userId] });
            queryClient.invalidateQueries({ queryKey: ['current-user'] });
        },
    });
}

export function useJoinSquad() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { userId: string; squadId: string }) =>
            api.joinSquad(params.userId, params.squadId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['user', variables.userId] });
            queryClient.invalidateQueries({ queryKey: ['current-user'] });
            queryClient.invalidateQueries({ queryKey: ['squad', variables.squadId] });
            queryClient.invalidateQueries({ queryKey: ['squads'] });
        },
    });
}

export function useLeaveSquad() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (userId: string) => api.leaveSquad(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user'] });
            queryClient.invalidateQueries({ queryKey: ['current-user'] });
            queryClient.invalidateQueries({ queryKey: ['squads'] });
        },
    });
}
