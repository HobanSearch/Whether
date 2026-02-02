import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import App from './App';
import './i18n'; // Initialize i18n
import './styles/index.css';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
        },
    },
});

const manifestUrl = import.meta.env.VITE_TONCONNECT_MANIFEST_URL || '/tonconnect-manifest.json';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <TonConnectUIProvider manifestUrl={manifestUrl}>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </TonConnectUIProvider>
        </QueryClientProvider>
    </React.StrictMode>
);
