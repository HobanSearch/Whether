import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMarkets } from '../hooks/useMarkets';
import { usePoolStats } from '../hooks/useLiquidity';
import { useTonAddress } from '@tonconnect/ui-react';
import MarketCard from '../components/MarketCard';
import './HomePage.css';

function HomePage() {
    const { t } = useTranslation();
    const address = useTonAddress();
    const { data: markets, isLoading: marketsLoading } = useMarkets();
    const { data: poolStats } = usePoolStats();

    const activeMarkets = markets?.filter((m) => m.status === 'active').slice(0, 3);

    return (
        <div className="container">
            <section className="hero">
                <img
                    src="/assets/hero-predict.png"
                    alt="Predict the Weather"
                    className="hero-image"
                />
                <img
                    src="/assets/hero-rain.png"
                    alt="Make it Rain"
                    className="hero-image"
                />
            </section>

            {!address && (
                <div className="connect-prompt card">
                    <p>{t('trading.connectToTrade')}</p>
                </div>
            )}

            <section className="stats-section">
                <div className="stats-grid">
                    <div className="stat-card">
                        <span className="stat-value">{markets?.length ?? '-'}</span>
                        <span className="stat-label">{t('markets.activeMarkets')}</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-value text-success">
                            {poolStats?.tvl_formatted ?? '—'} TON
                        </span>
                        <span className="stat-label">{t('markets.volume')}</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-value text-primary">
                            {poolStats?.apy != null ? `${poolStats.apy.toFixed(1)}%` : '—'}
                        </span>
                        <span className="stat-label">LP APY</span>
                    </div>
                </div>
            </section>

            <section className="markets-section">
                <div className="section-header">
                    <h3 className="section-title">{t('markets.activeMarkets')}</h3>
                    <Link to="/markets" className="section-link">
                        {t('common.viewAll')}
                    </Link>
                </div>

                {marketsLoading ? (
                    <div className="loading">
                        <div className="loading-spinner" />
                    </div>
                ) : activeMarkets && activeMarkets.length > 0 ? (
                    activeMarkets.map((market) => <MarketCard key={market.id} market={market} />)
                ) : (
                    <div className="empty-state card">
                        <p>{t('markets.noMarkets')}</p>
                    </div>
                )}
            </section>

            <section className="actions-section">
                <div className="section-header">
                    <h3 className="section-title">{t('nav.markets')}</h3>
                </div>

                <div className="actions-grid">
                    <Link to="/markets" className="action-card">
                        <img src="/assets/weather/chart.png" alt="Markets" className="action-icon-img" />
                        <span className="action-title">{t('nav.markets')}</span>
                        <span className="action-desc">{t('markets.subtitle')}</span>
                    </Link>
                    <Link to="/earn" className="action-card">
                        <img src="/assets/weather/coin.png" alt="Earn" className="action-icon-img" />
                        <span className="action-title">{t('nav.earn')}</span>
                        <span className="action-desc">{t('earn.subtitle')}</span>
                    </Link>
                </div>
            </section>
        </div>
    );
}

export default HomePage;

/* Add styles for new action icons, appended to file or existing CSS */
/* Since I can't edit HomePage.css directly here easily without viewing it, I'll inline styles via CSS file in next step or assume generic classes work. 
   But "action-icon-img" needs styling. */
