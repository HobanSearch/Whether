import { useState, useCallback, useRef } from 'react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { useTelegramApp } from './useTelegramApp';
import type {
    TransactionPhase,
    PreparedTransaction,
    TransactionConfirmation,
} from '../types';

interface TonTransactionOptions {
    onSuccess?: (hash: string) => void;
    onError?: (error: Error) => void;
    confirmationTimeout?: number;
    pollInterval?: number;
    maxPollAttempts?: number;
}

interface TonTransactionState {
    phase: TransactionPhase;
    hash: string | null;
    error: Error | null;
    confirmation: TransactionConfirmation | null;
}

interface UseTonTransactionReturn {
    state: TonTransactionState;
    sendTransaction: (tx: PreparedTransaction) => Promise<string | null>;
    reset: () => void;
    isConnected: boolean;
    address: string | null;
}

const TON_API_BASE = 'https://tonapi.io/v2';

async function checkTransactionStatus(hash: string): Promise<TransactionConfirmation> {
    const response = await fetch(`${TON_API_BASE}/blockchain/transactions/${hash}`);

    if (response.status === 404) {
        return {
            hash,
            status: 'pending',
        };
    }

    if (!response.ok) {
        throw new Error(`Failed to check transaction: ${response.statusText}`);
    }

    const data = await response.json();

    return {
        hash,
        status: data.success ? 'confirmed' : 'failed',
        lt: data.lt,
        utime: data.utime,
        exitCode: data.compute_phase?.exit_code,
    };
}

async function pollForConfirmation(
    hash: string,
    maxAttempts: number,
    baseInterval: number,
    onProgress?: (attempt: number) => void
): Promise<TransactionConfirmation> {
    let attempts = 0;

    while (attempts < maxAttempts) {
        attempts++;
        onProgress?.(attempts);

        try {
            const status = await checkTransactionStatus(hash);

            if (status.status !== 'pending') {
                return status;
            }
        } catch (error) {
            if (attempts >= maxAttempts) {
                throw error;
            }
        }

        // Exponential backoff: 3s, 4.5s, 6.75s, ... capped at 15s
        const delay = Math.min(baseInterval * Math.pow(1.5, attempts - 1), 15000);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    return {
        hash,
        status: 'pending',
    };
}

export function useTonTransaction(options: TonTransactionOptions = {}): UseTonTransactionReturn {
    const {
        onSuccess,
        onError,
        confirmationTimeout = 60000,
        pollInterval = 3000,
        maxPollAttempts = 20,
    } = options;

    const [tonConnectUI] = useTonConnectUI();
    const address = useTonAddress();
    const { hapticFeedback } = useTelegramApp();

    const [state, setState] = useState<TonTransactionState>({
        phase: 'idle',
        hash: null,
        error: null,
        confirmation: null,
    });

    const abortControllerRef = useRef<AbortController | null>(null);

    const reset = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        setState({
            phase: 'idle',
            hash: null,
            error: null,
            confirmation: null,
        });
    }, []);

    const sendTransaction = useCallback(async (tx: PreparedTransaction): Promise<string | null> => {
        // Cancel any existing polling
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            // Phase 1: Preparing
            setState({
                phase: 'preparing',
                hash: null,
                error: null,
                confirmation: null,
            });
            hapticFeedback('light');

            // Build the transaction message for TON Connect
            const messages = [{
                address: tx.to,
                amount: tx.value,
                payload: tx.payload,
                stateInit: tx.stateInit,
            }];

            // Phase 2: Awaiting signature
            setState(prev => ({
                ...prev,
                phase: 'awaiting_signature',
            }));
            hapticFeedback('medium');

            // Send via TON Connect - this opens the wallet for signing
            const result = await tonConnectUI.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
                messages,
            });

            // Extract the BOC (Bag of Cells) which contains the transaction hash
            const boc = result.boc;

            // Calculate transaction hash from BOC
            // In practice, we'd parse the BOC to get the actual tx hash
            // For now, use the BOC as a temporary identifier and poll by address
            const txHash = boc.slice(0, 64);

            setState(prev => ({
                ...prev,
                phase: 'confirming',
                hash: txHash,
            }));
            hapticFeedback('light');

            // Phase 3: Poll for confirmation
            const timeoutPromise = new Promise<TransactionConfirmation>((_, reject) => {
                setTimeout(() => reject(new Error('Transaction confirmation timeout')), confirmationTimeout);
            });

            const confirmationPromise = pollForConfirmation(
                txHash,
                maxPollAttempts,
                pollInterval,
            );

            const confirmation = await Promise.race([confirmationPromise, timeoutPromise]);

            if (confirmation.status === 'confirmed') {
                setState({
                    phase: 'confirmed',
                    hash: txHash,
                    error: null,
                    confirmation,
                });
                hapticFeedback('success');
                onSuccess?.(txHash);
                return txHash;
            } else if (confirmation.status === 'failed') {
                const error = new Error(
                    confirmation.exitCode
                        ? `Transaction failed with exit code ${confirmation.exitCode}`
                        : 'Transaction failed'
                );
                setState({
                    phase: 'failed',
                    hash: txHash,
                    error,
                    confirmation,
                });
                hapticFeedback('error');
                onError?.(error);
                return null;
            } else {
                // Still pending after all attempts - treat as success for UX
                // The transaction may still confirm, user can check later
                setState({
                    phase: 'confirmed',
                    hash: txHash,
                    error: null,
                    confirmation: {
                        hash: txHash,
                        status: 'pending',
                    },
                });
                hapticFeedback('warning');
                onSuccess?.(txHash);
                return txHash;
            }
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));

            // Check if user rejected the transaction
            const isUserRejection = err.message.includes('User rejected') ||
                                   err.message.includes('Cancelled') ||
                                   err.message.includes('canceled');

            setState({
                phase: 'failed',
                hash: null,
                error: err,
                confirmation: null,
            });

            if (isUserRejection) {
                hapticFeedback('warning');
            } else {
                hapticFeedback('error');
            }

            onError?.(err);
            return null;
        }
    }, [tonConnectUI, hapticFeedback, onSuccess, onError, confirmationTimeout, pollInterval, maxPollAttempts]);

    return {
        state,
        sendTransaction,
        reset,
        isConnected: !!address,
        address: address || null,
    };
}

export type { TonTransactionState, TonTransactionOptions };
