import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WalletState {
    address: string | null;
    balance: bigint;
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
    setAddress: (address: string | null) => void;
    setBalance: (balance: bigint) => void;
    setConnecting: (connecting: boolean) => void;
    setError: (error: string | null) => void;
    disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
    persist(
        (set) => ({
            address: null,
            balance: 0n,
            isConnected: false,
            isConnecting: false,
            error: null,
            setAddress: (address) =>
                set({
                    address,
                    isConnected: !!address,
                    isConnecting: false,
                }),
            setBalance: (balance) => set({ balance }),
            setConnecting: (isConnecting) => set({ isConnecting }),
            setError: (error) => set({ error, isConnecting: false }),
            disconnect: () =>
                set({
                    address: null,
                    balance: 0n,
                    isConnected: false,
                    isConnecting: false,
                    error: null,
                }),
        }),
        {
            name: 'tonsurance-wallet',
            partialize: (state) => ({ address: state.address }),
        }
    )
);
