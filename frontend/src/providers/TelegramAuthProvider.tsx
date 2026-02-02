import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useTelegramApp } from '../hooks/useTelegramApp';
import { useCreateOrUpdateUser, useCurrentUser } from '../hooks/useUser';
import type { User } from '../types';

interface TelegramAuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    authError: Error | null;
    refetchUser: () => void;
}

const TelegramAuthContext = createContext<TelegramAuthContextType>({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    authError: null,
    refetchUser: () => {},
});

interface TelegramAuthProviderProps {
    children: ReactNode;
}

export function TelegramAuthProvider({ children }: TelegramAuthProviderProps) {
    const { user: telegramUser, isTelegram, ready } = useTelegramApp();
    const createOrUpdateUser = useCreateOrUpdateUser();
    const [hasAttemptedCreation, setHasAttemptedCreation] = useState(false);
    const [authError, setAuthError] = useState<Error | null>(null);

    const telegramId = telegramUser?.id;
    const { data: user, refetch: refetchUser } = useCurrentUser(telegramId);

    useEffect(() => {
        if (!ready) return;
        if (!isTelegram) return; // Only create users when running inside Telegram
        if (hasAttemptedCreation) return;
        if (!telegramId) return;

        // Create or update user when Telegram data is available
        setHasAttemptedCreation(true);
        createOrUpdateUser.mutate({
            telegramId,
            username: telegramUser?.username,
        }, {
            onError: (error) => {
                console.error('Failed to create/update user:', error);
                setAuthError(error instanceof Error ? error : new Error('Auth failed'));
            },
        });
    }, [ready, isTelegram, telegramId, telegramUser?.username, hasAttemptedCreation, createOrUpdateUser]);

    // Never block rendering - auth is a background operation
    // The app should work even if the backend is unavailable
    const isLoading = false;
    const isAuthenticated = !!user;

    return (
        <TelegramAuthContext.Provider value={{
            user: user || null,
            isLoading,
            isAuthenticated,
            authError,
            refetchUser,
        }}>
            {children}
        </TelegramAuthContext.Provider>
    );
}

export function useTelegramAuth() {
    const context = useContext(TelegramAuthContext);
    if (!context) {
        throw new Error('useTelegramAuth must be used within a TelegramAuthProvider');
    }
    return context;
}

export { TelegramAuthContext };
