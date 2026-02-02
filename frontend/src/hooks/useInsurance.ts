import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { PurchasePolicyParams } from '../types';

export function useInsurancePolicies(walletAddress: string | undefined) {
    return useQuery({
        queryKey: ['insurance-policies', walletAddress],
        queryFn: () => api.getInsurancePolicies(walletAddress!),
        enabled: !!walletAddress,
        refetchInterval: 30_000,
    });
}

export function useInsuranceQuote(params: {
    coverageAmount: bigint;
    duration: number;
    location: string;
    threshold: number;
    comparison: 'above' | 'below';
}) {
    return useQuery({
        queryKey: ['insurance-quote', { ...params, coverageAmount: params.coverageAmount.toString() }],
        queryFn: () =>
            api.getInsuranceQuote(
                params.coverageAmount,
                params.duration,
                params.location,
                params.threshold,
                params.comparison
            ),
        enabled: params.coverageAmount > 0n && params.duration > 0,
    });
}

export function useCapitalPool() {
    return useQuery({
        queryKey: ['capital-pool'],
        queryFn: api.getCapitalPool,
        refetchInterval: 30_000,
    });
}

export function usePurchasePolicy() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: PurchasePolicyParams) => api.purchasePolicy(params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['insurance-policies'] });
            queryClient.invalidateQueries({ queryKey: ['capital-pool'] });
        },
    });
}

export function useClaimInsurance() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (policyId: string) => api.claimInsurance(policyId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['insurance-policies'] });
            queryClient.invalidateQueries({ queryKey: ['capital-pool'] });
        },
    });
}

export function useAddCapital() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (amount: bigint) => api.addCapital(amount),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['capital-pool'] });
        },
    });
}
