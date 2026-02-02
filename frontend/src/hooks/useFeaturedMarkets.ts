import { useMemo } from 'react';
import type { Market, FeaturedMarket, ProductLine } from '../types';
import { safeBigIntToNumber } from '../utils/format';

export function useFeaturedMarkets(markets: Market[] | undefined) {
    return useMemo(() => {
        if (!markets || markets.length === 0) {
            return {
                featuredMarket: null,
                hotMarkets: [],
            };
        }

        const now = Date.now() / 1000;
        const activeMarkets = markets.filter(
            (m) => m.status === 'active' && m.settlementTime > now
        );

        const scoredMarkets: FeaturedMarket[] = activeMarkets.map((market) => {
            let score = 0;
            let reason: FeaturedMarket['featuredReason'] = 'hot';

            const volume = safeBigIntToNumber(market.totalVolume);
            score += Math.min(volume / 1e9, 100);

            score += market.uniqueBettors * 2;

            const hoursUntilSettlement = (market.settlementTime - now) / 3600;
            if (hoursUntilSettlement <= 24) {
                score += 30;
                reason = 'closing_soon';
            } else if (hoursUntilSettlement <= 72) {
                score += 15;
            }

            const recencyHours = (now - market.createdAt) / 3600;
            if (recencyHours <= 24) {
                score += 20;
                reason = 'new';
            }

            const totalCollateral = safeBigIntToNumber(market.totalCollateral);
            if (totalCollateral > 10e9) {
                score += 25;
                reason = 'high_volume';
            }

            return {
                ...market,
                featuredReason: reason,
                featuredScore: score,
            };
        });

        scoredMarkets.sort((a, b) => (b.featuredScore || 0) - (a.featuredScore || 0));

        return {
            featuredMarket: scoredMarkets[0] || null,
            hotMarkets: scoredMarkets.slice(1, 6),
        };
    }, [markets]);
}

export function useMarketsByProductLine(markets: Market[] | undefined) {
    return useMemo(() => {
        if (!markets) return {};

        const grouped: Record<ProductLine | 'other', Market[]> = {
            airport: [],
            urban: [],
            precipitation: [],
            extreme: [],
            energy: [],
            agricultural: [],
            other: [],
        };

        markets.forEach((market) => {
            const line = market.productLine || 'other';
            if (grouped[line]) {
                grouped[line].push(market);
            } else {
                grouped.other.push(market);
            }
        });

        return grouped;
    }, [markets]);
}

export function useFilteredMarkets(
    markets: Market[] | undefined,
    filters: {
        productLine?: ProductLine | 'all';
        status?: string;
        search?: string;
    }
) {
    return useMemo(() => {
        if (!markets) return [];

        let filtered = [...markets];

        if (filters.productLine && filters.productLine !== 'all') {
            filtered = filtered.filter((m) => m.productLine === filters.productLine);
        }

        if (filters.status && filters.status !== 'all') {
            filtered = filtered.filter((m) => m.status === filters.status);
        }

        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(
                (m) =>
                    m.question.toLowerCase().includes(searchLower) ||
                    m.location.toLowerCase().includes(searchLower)
            );
        }

        return filtered;
    }, [markets, filters.productLine, filters.status, filters.search]);
}
