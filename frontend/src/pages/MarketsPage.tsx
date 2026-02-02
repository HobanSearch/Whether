import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMarkets } from '../hooks/useMarkets';
import { useFeaturedMarkets, useFilteredMarkets } from '../hooks/useFeaturedMarkets';
import MarketCard from '../components/MarketCard';
import FeaturedMarketHero from '../components/FeaturedMarketHero';
import HotMarketsCarousel from '../components/HotMarketsCarousel';
import ProductLineChips from '../components/ProductLineChips';
import { LOCATIONS } from '../data/locations';
import type { ProductLine } from '../types';
import './MarketsPage.css';

type FilterStatus = 'all' | 'active' | 'settled';

function MarketsPage() {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const initialLocation = searchParams.get('location') || 'all';

    const [statusFilter, setStatusFilter] = useState<FilterStatus>('active');
    const [productLine, setProductLine] = useState<ProductLine | 'all'>('all');
    const [regionFilter, setRegionFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const apiFilters = useMemo(() => {
        const filters: { location?: string; status?: string } = {};
        if (initialLocation !== 'all') filters.location = initialLocation;
        if (statusFilter !== 'all') filters.status = statusFilter;
        return filters;
    }, [initialLocation, statusFilter]);

    const { data: markets, isLoading, error } = useMarkets(apiFilters);

    const { featuredMarket, hotMarkets } = useFeaturedMarkets(markets);

    const filteredMarkets = useFilteredMarkets(markets, {
        productLine,
        status: statusFilter,
        search: searchQuery,
    });

    const displayMarkets = useMemo(() => {
        if (!filteredMarkets) return [];
        const featuredId = featuredMarket?.id;
        const hotIds = new Set(hotMarkets.map((m) => m.id));
        return filteredMarkets.filter((m) => m.id !== featuredId && !hotIds.has(m.id));
    }, [filteredMarkets, featuredMarket, hotMarkets]);

    const regions = useMemo(() => {
        const regionSet = new Set(LOCATIONS.map((l) => l.region).filter(Boolean));
        return Array.from(regionSet).sort();
    }, []);

    const showFeaturedSection = statusFilter === 'active' && productLine === 'all' && !searchQuery;

    return (
        <div className="container markets-page">
            <header className="page-header">
                <h2 className="page-title">{t('markets.title')}</h2>
                <p className="page-subtitle text-hint">{t('markets.subtitle')}</p>
            </header>

            {showFeaturedSection && featuredMarket && (
                <section className="featured-section">
                    <FeaturedMarketHero market={featuredMarket} />
                </section>
            )}

            {showFeaturedSection && hotMarkets.length > 0 && (
                <section className="hot-markets-section">
                    <HotMarketsCarousel markets={hotMarkets} />
                </section>
            )}

            <section className="product-lines-section">
                <ProductLineChips
                    selected={productLine}
                    onChange={setProductLine}
                />
            </section>

            <section className="filters-section">
                <div className="compact-filters">
                    <div className="filter-group">
                        <label className="filter-label text-hint">{t('markets.filterByStatus')}</label>
                        <div className="filter-options">
                            {(['active', 'settled', 'all'] as const).map((status) => (
                                <button
                                    key={status}
                                    className={`filter-btn ${statusFilter === status ? 'active' : ''}`}
                                    onClick={() => setStatusFilter(status)}
                                >
                                    {status === 'all' ? t('common.all') : t(`markets.status.${status}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="filter-group">
                        <label className="filter-label text-hint">{t('squads.region')}</label>
                        <select
                            className="filter-select"
                            value={regionFilter}
                            onChange={(e) => setRegionFilter(e.target.value)}
                        >
                            <option value="all">{t('common.all')}</option>
                            {regions.map((region) => (
                                <option key={region} value={region}>
                                    {region}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group search-group">
                        <label className="filter-label text-hint">{t('common.search')}</label>
                        <input
                            type="text"
                            className="filter-input"
                            placeholder={t('markets.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </section>

            <section className="markets-section">
                {isLoading ? (
                    <div className="loading">
                        <div className="loading-spinner" />
                    </div>
                ) : error ? (
                    <div className="error-state glass-panel">
                        <p>{t('errors.generic')}</p>
                        <p className="text-hint text-sm">{t('common.retry')}</p>
                    </div>
                ) : displayMarkets.length > 0 ? (
                    <>
                        <div className="results-header">
                            <span className="results-count text-hint text-sm">
                                {displayMarkets.length} {t('nav.markets').toLowerCase()}
                            </span>
                        </div>
                        <div className="markets-grid">
                            {displayMarkets.map((market) => (
                                <MarketCard key={market.id} market={market} />
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="empty-state glass-panel">
                        <img src="/assets/weather/cloudy.png" alt="No markets" className="action-icon-img" />
                        <p>{t('markets.noMarkets')}</p>
                        <p className="text-hint text-sm">{t('common.noResults')}</p>
                    </div>
                )}
            </section>
        </div>
    );
}

export default MarketsPage;
