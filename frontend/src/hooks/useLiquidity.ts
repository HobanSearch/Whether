import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

/**
 * Hook for fetching pool statistics.
 * Includes TVL, APY, share price, and LP count.
 */
export function usePoolStats() {
    return useQuery({
        queryKey: ['pool-stats'],
        queryFn: () => api.getPoolStats(),
        refetchInterval: 30000, // Refresh every 30s
        staleTime: 10000,
    });
}

/**
 * Hook for fetching user's LP position.
 */
export function useLPPosition(walletAddress: string | undefined) {
    return useQuery({
        queryKey: ['lp-position', walletAddress],
        queryFn: () => api.getLPPosition(walletAddress!),
        enabled: !!walletAddress,
        refetchInterval: 30000,
        staleTime: 10000,
    });
}

/**
 * Hook for fetching LP transaction history.
 */
export function useLPTransactions(
    walletAddress: string | undefined,
    limit = 50,
    offset = 0
) {
    return useQuery({
        queryKey: ['lp-transactions', walletAddress, limit, offset],
        queryFn: () => api.getLPTransactions(walletAddress!, limit, offset),
        enabled: !!walletAddress,
        staleTime: 30000,
    });
}

/**
 * Hook for fetching APY history.
 */
export function useAPYHistory(days = 30) {
    return useQuery({
        queryKey: ['apy-history', days],
        queryFn: () => api.getAPYHistory(days),
        staleTime: 60000, // 1 minute
    });
}

/**
 * Hook for deposit estimation.
 */
export function useDepositEstimate(amount: string | undefined) {
    return useQuery({
        queryKey: ['deposit-estimate', amount],
        queryFn: () => api.getDepositEstimate(amount!),
        enabled: !!amount && parseFloat(amount) > 0,
        staleTime: 5000,
    });
}

/**
 * Hook for withdrawal estimation.
 */
export function useWithdrawEstimate(shares: string | undefined) {
    return useQuery({
        queryKey: ['withdraw-estimate', shares],
        queryFn: () => api.getWithdrawEstimate(shares!),
        enabled: !!shares && parseFloat(shares) > 0,
        staleTime: 5000,
    });
}

/**
 * Mutation hook for preparing a deposit transaction.
 * Returns the unsigned transaction for TON Connect signing.
 */
export function usePrepareDeposit() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { walletAddress: string; amount: string }) =>
            api.prepareDeposit(params.walletAddress, params.amount),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pool-stats'] });
            queryClient.invalidateQueries({ queryKey: ['lp-position'] });
        },
    });
}

/**
 * Mutation hook for preparing a withdrawal transaction.
 * Returns the unsigned transaction for TON Connect signing.
 */
export function usePrepareWithdraw() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { walletAddress: string; shares: string }) =>
            api.prepareWithdraw(params.walletAddress, params.shares),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pool-stats'] });
            queryClient.invalidateQueries({ queryKey: ['lp-position'] });
        },
    });
}

/**
 * Hook to invalidate all LP-related queries.
 * Useful after a successful transaction.
 */
export function useInvalidateLPQueries() {
    const queryClient = useQueryClient();

    return () => {
        queryClient.invalidateQueries({ queryKey: ['pool-stats'] });
        queryClient.invalidateQueries({ queryKey: ['lp-position'] });
        queryClient.invalidateQueries({ queryKey: ['lp-transactions'] });
        queryClient.invalidateQueries({ queryKey: ['apy-history'] });
    };
}

/**
 * Combined hook for LP operations with wallet.
 * Provides pool stats, position, and mutations.
 */
export function useLiquidity(walletAddress: string | undefined) {
    const poolStats = usePoolStats();
    const position = useLPPosition(walletAddress);
    const prepareDeposit = usePrepareDeposit();
    const prepareWithdraw = usePrepareWithdraw();
    const invalidateQueries = useInvalidateLPQueries();

    return {
        // Queries
        poolStats,
        position,
        // Mutations
        prepareDeposit,
        prepareWithdraw,
        // Helpers
        invalidateQueries,
        // Convenience
        isLoading: poolStats.isLoading || position.isLoading,
        hasPosition: position.data?.shares && BigInt(position.data.shares) > 0n,
    };
}
