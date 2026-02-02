import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useCallback, useRef } from 'react';
import { api, type MarketFilters } from '../services/api';
import type {
    TradeParams,
    PrepareBetRequest,
    PrepareClaimRequest,
} from '../types';

export function useMarkets(filters?: MarketFilters) {
    const isVisible = useVisibilityPolling();
    // 10s when visible, pause when hidden (background tabs don't need market list updates)
    const pollInterval = isVisible ? 10000 : false;

    return useQuery({
        queryKey: ['markets', filters],
        queryFn: () => api.getMarkets(filters),
        refetchInterval: pollInterval,
        staleTime: 5000,
    });
}

export function useMarketsByLocation(locationCode: string | undefined, status?: string) {
    const isVisible = useVisibilityPolling();
    const pollInterval = isVisible ? 10000 : false;

    return useQuery({
        queryKey: ['markets-by-location', locationCode, status],
        queryFn: () => api.getMarketsByLocation(locationCode!, status),
        enabled: !!locationCode,
        refetchInterval: pollInterval,
        staleTime: 5000,
    });
}

export function useMarket(marketId: string) {
    const isVisible = useVisibilityPolling();
    // Market detail: 5s when visible, 60s when hidden
    const pollInterval = isVisible ? 5000 : 60000;

    return useQuery({
        queryKey: ['market', marketId],
        queryFn: () => api.getMarket(marketId),
        refetchInterval: pollInterval,
        staleTime: 3000,
    });
}

export function useMarketPrices(marketId: string) {
    const isVisible = useVisibilityPolling();
    // Price updates: 3s when visible, pause when hidden
    const pollInterval = isVisible ? 3000 : false;

    return useQuery({
        queryKey: ['market-prices', marketId],
        queryFn: () => api.getMarketPrices(marketId),
        refetchInterval: pollInterval,
        staleTime: 2000,
    });
}

export function usePositions(walletAddress: string | undefined) {
    const isVisible = useVisibilityPolling();
    // Positions: 30s when visible, pause when hidden
    const pollInterval = isVisible ? 30000 : false;

    return useQuery({
        queryKey: ['positions', walletAddress],
        queryFn: () => api.getPositions(walletAddress!),
        enabled: !!walletAddress,
        refetchInterval: pollInterval,
        staleTime: 10000,
    });
}

export function useTrade() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: TradeParams) => api.executeTrade(params),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['market', variables.marketId] });
            queryClient.invalidateQueries({ queryKey: ['market-prices', variables.marketId] });
            queryClient.invalidateQueries({ queryKey: ['positions'] });
        },
    });
}

export function useMintTokens() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { marketId: string; amount: bigint }) =>
            api.mintTokens(params.marketId, params.amount),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['market', variables.marketId] });
            queryClient.invalidateQueries({ queryKey: ['positions'] });
        },
    });
}

export function useRedeemTokens() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { marketId: string; amount: bigint }) =>
            api.redeemTokens(params.marketId, params.amount),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['market', variables.marketId] });
            queryClient.invalidateQueries({ queryKey: ['positions'] });
        },
    });
}

export function useClaimPayout() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { marketId: string; tokenType: 'YES' | 'NO' }) =>
            api.claimPayout(params.marketId, params.tokenType),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['positions'] });
        },
    });
}

// ============================================
// REAL-TIME TRADING HOOKS
// ============================================

/**
 * Hook for tracking document visibility for adaptive polling.
 * Returns true when the document is visible, false when hidden.
 */
export function useVisibilityPolling() {
    const [isVisible, setIsVisible] = useState(!document.hidden);

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsVisible(!document.hidden);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return isVisible;
}

/**
 * Hook for real-time market odds with adaptive polling.
 * Polls every 2s when visible, 60s when hidden.
 */
export function useRealTimeOdds(marketId: string | undefined, enabled = true) {
    const isVisible = useVisibilityPolling();
    const pollInterval = isVisible ? 2000 : 60000;

    return useQuery({
        queryKey: ['market-odds', marketId],
        queryFn: () => api.getMarketOdds(marketId!),
        enabled: !!marketId && enabled,
        refetchInterval: pollInterval,
        staleTime: 1000,
    });
}

/**
 * Hook for fetching user's position in a specific market.
 */
export function useUserPosition(marketId: string | undefined, userAddress: string | undefined) {
    return useQuery({
        queryKey: ['user-position', marketId, userAddress],
        queryFn: () => api.getUserPosition(marketId!, userAddress!),
        enabled: !!marketId && !!userAddress,
        refetchInterval: 10000,
    });
}

/**
 * Hook for market settlement status.
 */
export function useSettlementStatus(marketId: string | undefined, enabled = true) {
    return useQuery({
        queryKey: ['settlement-status', marketId],
        queryFn: () => api.getSettlementStatus(marketId!),
        enabled: !!marketId && enabled,
        refetchInterval: 30000,
    });
}

/**
 * Hook for server-side trade estimate.
 * Debounced to avoid excessive API calls during amount input.
 */
export function useTradeEstimate(
    marketId: string | undefined,
    side: 'YES' | 'NO' | undefined,
    amount: string | undefined,
    enabled = true,
    bracketIndex?: number
) {
    const [debouncedAmount, setDebouncedAmount] = useState(amount);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setDebouncedAmount(amount);
        }, 300);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [amount]);

    const isValidAmount = !!debouncedAmount && parseFloat(debouncedAmount) > 0;

    return useQuery({
        queryKey: ['trade-estimate', marketId, side, debouncedAmount, bracketIndex],
        queryFn: () => api.getTradeEstimate(marketId!, side!, debouncedAmount!, bracketIndex),
        enabled: !!marketId && !!side && isValidAmount && enabled,
        staleTime: 5000,
        retry: false,
    });
}

/**
 * Mutation hook for preparing a bet transaction.
 * Returns the unsigned transaction for TON Connect signing.
 */
export function usePrepareBet() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { marketId: string; request: PrepareBetRequest }) =>
            api.prepareBet(params.marketId, params.request),
        onSuccess: (_, variables) => {
            // Invalidate odds to get fresh prices
            queryClient.invalidateQueries({ queryKey: ['market-odds', variables.marketId] });
        },
    });
}

/**
 * Mutation hook for preparing a claim transaction.
 * Returns the unsigned transaction for TON Connect signing.
 */
export function usePrepareClaim() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { marketId: string; request: PrepareClaimRequest }) =>
            api.prepareClaim(params.marketId, params.request),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['positions'] });
        },
    });
}

/**
 * Mutation hook for preparing a refund transaction.
 */
export function usePrepareRefund() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { marketId: string; userAddress: string }) =>
            api.prepareRefund(params.marketId, params.userAddress),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['positions'] });
        },
    });
}

/**
 * Hook that invalidates all market-related queries.
 * Useful after a successful transaction.
 */
export function useInvalidateMarketQueries() {
    const queryClient = useQueryClient();

    return useCallback(
        (marketId: string) => {
            queryClient.invalidateQueries({ queryKey: ['market', marketId] });
            queryClient.invalidateQueries({ queryKey: ['market-prices', marketId] });
            queryClient.invalidateQueries({ queryKey: ['market-odds', marketId] });
            queryClient.invalidateQueries({ queryKey: ['positions'] });
            queryClient.invalidateQueries({ queryKey: ['user-position', marketId] });
            queryClient.invalidateQueries({ queryKey: ['settlement-status', marketId] });
        },
        [queryClient]
    );
}

/**
 * Mutation hook for refreshing market data from contract.
 */
export function useRefreshMarket() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (marketId: string) => api.refreshMarket(marketId),
        onSuccess: (_, marketId) => {
            queryClient.invalidateQueries({ queryKey: ['market', marketId] });
            queryClient.invalidateQueries({ queryKey: ['market-prices', marketId] });
            queryClient.invalidateQueries({ queryKey: ['market-odds', marketId] });
        },
    });
}

/**
 * Mutation hook for submitting a dispute on a settled market.
 */
export function useSubmitDispute() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: {
            marketId: string;
            userAddress: string;
            reason: string;
            evidence: string;
        }) => api.submitDispute(params.marketId, params.userAddress, params.reason, params.evidence),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['market', variables.marketId] });
            queryClient.invalidateQueries({ queryKey: ['positions'] });
        },
    });
}
