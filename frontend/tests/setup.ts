import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock TON Connect
vi.mock('@tonconnect/ui-react', () => ({
    TonConnectUIProvider: ({ children }: { children: React.ReactNode }) => children,
    useTonConnectUI: () => [
        {
            connectWallet: vi.fn(),
            disconnect: vi.fn(),
        },
    ],
    useTonWallet: () => null,
    useTonAddress: () => null,
}));

// Mock Telegram Mini Apps SDK
vi.mock('@telegram-apps/sdk-react', () => ({
    SDKProvider: ({ children }: { children: React.ReactNode }) => children,
    useLaunchParams: () => ({}),
    useMainButton: () => ({
        show: vi.fn(),
        hide: vi.fn(),
        setText: vi.fn(),
        onClick: vi.fn(),
    }),
    useBackButton: () => ({
        show: vi.fn(),
        hide: vi.fn(),
        onClick: vi.fn(),
    }),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});
