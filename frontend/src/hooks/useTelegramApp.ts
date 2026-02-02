import { useEffect, useState, useCallback } from 'react';

interface TelegramWebApp {
    initData: string;
    initDataUnsafe: {
        query_id?: string;
        user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_premium?: boolean;
        };
        auth_date: number;
        hash: string;
    };
    version: string;
    platform: string;
    colorScheme: 'light' | 'dark';
    themeParams: {
        bg_color?: string;
        text_color?: string;
        hint_color?: string;
        link_color?: string;
        button_color?: string;
        button_text_color?: string;
        secondary_bg_color?: string;
    };
    isExpanded: boolean;
    viewportHeight: number;
    viewportStableHeight: number;
    MainButton: {
        text: string;
        color: string;
        textColor: string;
        isVisible: boolean;
        isActive: boolean;
        isProgressVisible: boolean;
        setText(text: string): void;
        onClick(callback: () => void): void;
        offClick(callback: () => void): void;
        show(): void;
        hide(): void;
        enable(): void;
        disable(): void;
        showProgress(leaveActive?: boolean): void;
        hideProgress(): void;
        setParams(params: {
            text?: string;
            color?: string;
            text_color?: string;
            is_active?: boolean;
            is_visible?: boolean;
        }): void;
    };
    BackButton: {
        isVisible: boolean;
        onClick(callback: () => void): void;
        offClick(callback: () => void): void;
        show(): void;
        hide(): void;
    };
    HapticFeedback: {
        impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
        notificationOccurred(type: 'error' | 'success' | 'warning'): void;
        selectionChanged(): void;
    };
    close(): void;
    expand(): void;
    enableClosingConfirmation(): void;
    disableClosingConfirmation(): void;
    setHeaderColor(color: string): void;
    setBackgroundColor(color: string): void;
    ready(): void;
    sendData(data: string): void;
    openLink(url: string, options?: { try_instant_view?: boolean }): void;
    openTelegramLink(url: string): void;
    showPopup(
        params: {
            title?: string;
            message: string;
            buttons?: Array<{
                id?: string;
                type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
                text?: string;
            }>;
        },
        callback?: (buttonId: string) => void
    ): void;
    showAlert(message: string, callback?: () => void): void;
    showConfirm(message: string, callback?: (confirmed: boolean) => void): void;
}

declare global {
    interface Window {
        Telegram?: {
            WebApp: TelegramWebApp;
        };
    }
}

export function useTelegramApp() {
    const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            setWebApp(tg);
            tg.ready();
            setReady(true);
        }
    }, []);

    const user = webApp?.initDataUnsafe?.user;
    const colorScheme = webApp?.colorScheme ?? 'light';
    const themeParams = webApp?.themeParams ?? {};

    const hapticFeedback = useCallback(
        (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' | 'selection') => {
            if (!webApp?.HapticFeedback) return;

            switch (type) {
                case 'light':
                case 'medium':
                case 'heavy':
                    webApp.HapticFeedback.impactOccurred(type);
                    break;
                case 'success':
                case 'error':
                case 'warning':
                    webApp.HapticFeedback.notificationOccurred(type);
                    break;
                case 'selection':
                    webApp.HapticFeedback.selectionChanged();
                    break;
            }
        },
        [webApp]
    );

    const showAlert = useCallback(
        (message: string) => {
            if (webApp) {
                webApp.showAlert(message);
            } else {
                alert(message);
            }
        },
        [webApp]
    );

    const showConfirm = useCallback(
        (message: string): Promise<boolean> => {
            return new Promise((resolve) => {
                if (webApp) {
                    webApp.showConfirm(message, resolve);
                } else {
                    resolve(confirm(message));
                }
            });
        },
        [webApp]
    );

    // Check if running in a Telegram environment (not standard browser)
    // 'unknown' usually indicates a standard browser with the script loaded
    const isTelegram = !!webApp && webApp.platform !== 'unknown';

    return {
        webApp,
        ready,
        isTelegram,
        user,
        colorScheme,
        themeParams,
        hapticFeedback,
        showAlert,
        showConfirm,
    };
}
