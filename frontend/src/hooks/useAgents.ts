import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { AgentStatus, StrategyConfig } from '../types';
import { useVisibilityPolling } from './useMarkets';

export function useAgents(userId?: string, status?: AgentStatus) {
    const isVisible = useVisibilityPolling();
    const pollInterval = isVisible ? 30000 : false;

    return useQuery({
        queryKey: ['agents', userId, status],
        queryFn: () => api.getAgents(userId, status),
        refetchInterval: pollInterval,
        staleTime: 10000,
    });
}

export function useAgent(agentId: string | undefined) {
    const isVisible = useVisibilityPolling();
    const pollInterval = isVisible ? 15000 : 60000;

    return useQuery({
        queryKey: ['agent', agentId],
        queryFn: () => api.getAgent(agentId!),
        enabled: !!agentId,
        refetchInterval: pollInterval,
        staleTime: 5000,
    });
}

export function useCreateAgent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: {
            telegramChatId: number;
            strategyName: string;
            strategyConfig: StrategyConfig;
        }) => api.createAgent(params.telegramChatId, params.strategyName, params.strategyConfig),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agents'] });
        },
    });
}

export function useUpdateAgent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: {
            agentId: string;
            updates: { status?: AgentStatus; strategyConfig?: StrategyConfig };
        }) => api.updateAgent(params.agentId, params.updates),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['agent', variables.agentId] });
            queryClient.invalidateQueries({ queryKey: ['agents'] });
        },
    });
}

export function useAgentPositions(agentId: string | undefined, status?: string) {
    const isVisible = useVisibilityPolling();
    const pollInterval = isVisible ? 15000 : false;

    return useQuery({
        queryKey: ['agent-positions', agentId, status],
        queryFn: () => api.getAgentPositions(agentId!, status),
        enabled: !!agentId,
        refetchInterval: pollInterval,
        staleTime: 5000,
    });
}

export function useCreateAgentPosition() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: {
            agentId: string;
            marketId: string;
            direction: 'YES' | 'NO';
            amount: string;
        }) => api.createAgentPosition(params.agentId, params.marketId, params.direction, params.amount),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['agent-positions', variables.agentId] });
            queryClient.invalidateQueries({ queryKey: ['agent', variables.agentId] });
        },
    });
}

export function useAgentPredictions(agentId: string | undefined) {
    const isVisible = useVisibilityPolling();
    const pollInterval = isVisible ? 30000 : false;

    return useQuery({
        queryKey: ['agent-predictions', agentId],
        queryFn: () => api.getAgentPredictions(agentId!),
        enabled: !!agentId,
        refetchInterval: pollInterval,
        staleTime: 10000,
    });
}

export function useAgentLeaderboard(period: string = 'all_time') {
    const isVisible = useVisibilityPolling();
    const pollInterval = isVisible ? 60000 : false;

    return useQuery({
        queryKey: ['agent-leaderboard', period],
        queryFn: () => api.getAgentLeaderboard(period),
        refetchInterval: pollInterval,
        staleTime: 30000,
    });
}

export function useAgentRank(agentId: string | undefined, period: string = 'all_time') {
    return useQuery({
        queryKey: ['agent-rank', agentId, period],
        queryFn: () => api.getAgentRank(agentId!, period),
        enabled: !!agentId,
        staleTime: 60000,
    });
}

export function usePauseAgent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (agentId: string) => api.updateAgent(agentId, { status: 'paused' }),
        onSuccess: (_, agentId) => {
            queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
            queryClient.invalidateQueries({ queryKey: ['agents'] });
        },
    });
}

export function useResumeAgent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (agentId: string) => api.updateAgent(agentId, { status: 'active' }),
        onSuccess: (_, agentId) => {
            queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
            queryClient.invalidateQueries({ queryKey: ['agents'] });
        },
    });
}

export function useStopAgent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (agentId: string) => api.updateAgent(agentId, { status: 'stopped' }),
        onSuccess: (_, agentId) => {
            queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
            queryClient.invalidateQueries({ queryKey: ['agents'] });
        },
    });
}
