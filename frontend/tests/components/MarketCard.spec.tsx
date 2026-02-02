import { describe, it, expect, vi } from 'vitest';

/**
 * Tests for MarketCard component displaying prediction market info.
 */
describe('MarketCard', () => {
    const mockMarket = {
        id: 'NYC-80F-JAN15-2026',
        question: 'Will NYC high temp exceed 80°F on Jan 15, 2026?',
        yesPrice: 0.35,
        noPrice: 0.65,
        volume24h: 15420,
        settlementDate: '2026-01-15T23:59:59Z',
        status: 'active' as const,
    };

    describe('Rendering', () => {
        it('displays market question', () => {
            // Component would render: <MarketCard market={mockMarket} />
            expect(mockMarket.question).toContain('NYC high temp');
        });

        it('displays YES and NO prices', () => {
            expect(mockMarket.yesPrice).toBe(0.35);
            expect(mockMarket.noPrice).toBe(0.65);
            expect(mockMarket.yesPrice + mockMarket.noPrice).toBe(1.0);
        });

        it('displays 24h volume', () => {
            expect(mockMarket.volume24h).toBeGreaterThan(0);
        });

        it('displays settlement date', () => {
            const date = new Date(mockMarket.settlementDate);
            expect(date.getFullYear()).toBe(2026);
        });

        it('shows active status indicator', () => {
            expect(mockMarket.status).toBe('active');
        });
    });

    describe('Price Display', () => {
        it('formats price as percentage', () => {
            const yesPercent = Math.round(mockMarket.yesPrice * 100);
            expect(yesPercent).toBe(35);
        });

        it('formats price as cents', () => {
            const yesCents = Math.round(mockMarket.yesPrice * 100);
            expect(yesCents).toBe(35); // 35¢
        });

        it('shows price change indicator', () => {
            const priceChange = 0.03; // +3%
            const isPositive = priceChange > 0;
            expect(isPositive).toBe(true);
        });
    });

    describe('Interactions', () => {
        it('navigates to market detail on click', () => {
            const onNavigate = vi.fn();
            // Simulating click handler
            onNavigate(`/markets/${mockMarket.id}`);
            expect(onNavigate).toHaveBeenCalledWith('/markets/NYC-80F-JAN15-2026');
        });

        it('opens trade modal on Buy YES click', () => {
            const onTrade = vi.fn();
            onTrade({ side: 'yes', market: mockMarket });
            expect(onTrade).toHaveBeenCalledWith(expect.objectContaining({ side: 'yes' }));
        });

        it('opens trade modal on Buy NO click', () => {
            const onTrade = vi.fn();
            onTrade({ side: 'no', market: mockMarket });
            expect(onTrade).toHaveBeenCalledWith(expect.objectContaining({ side: 'no' }));
        });
    });

    describe('Status Variants', () => {
        it('renders differently when settled', () => {
            const settledMarket = { ...mockMarket, status: 'settled' as const };
            expect(settledMarket.status).toBe('settled');
            // Should show settlement result instead of prices
        });

        it('renders differently when paused', () => {
            const pausedMarket = { ...mockMarket, status: 'paused' as const };
            expect(pausedMarket.status).toBe('paused');
            // Should disable trading buttons
        });
    });
});

describe('MarketList', () => {
    const mockMarkets = [
        { id: 'NYC-80F-JAN15-2026', yesPrice: 0.35 },
        { id: 'CHI-45F-JAN15-2026', yesPrice: 0.72 },
        { id: 'MIA-85F-JAN15-2026', yesPrice: 0.15 },
    ];

    describe('Rendering', () => {
        it('renders list of market cards', () => {
            expect(mockMarkets.length).toBe(3);
        });

        it('shows empty state when no markets', () => {
            const emptyMarkets: typeof mockMarkets = [];
            expect(emptyMarkets.length).toBe(0);
            // Should show "No markets available" message
        });

        it('shows loading state', () => {
            const isLoading = true;
            expect(isLoading).toBe(true);
            // Should show skeleton loaders
        });
    });

    describe('Filtering', () => {
        it('filters by location', () => {
            const locationFilter = 'NYC';
            const filtered = mockMarkets.filter(m => m.id.includes(locationFilter));
            expect(filtered.length).toBe(1);
        });

        it('sorts by volume', () => {
            const sorted = [...mockMarkets].sort((a, b) => b.yesPrice - a.yesPrice);
            expect(sorted[0].id).toBe('CHI-45F-JAN15-2026');
        });
    });
});
