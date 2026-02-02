import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useMarket } from '../hooks/useMarkets';
import { useTelegramApp } from '../hooks/useTelegramApp';
import TradeForm from '../components/TradeForm';
import MarketRulesCard from '../components/MarketRulesCard';
import { LOCATIONS } from '../types';
import { formatTon, formatTemperature, formatDate, formatPercent } from '../utils/format';
import './MarketDetailPage.css';

function MarketDetailPage() {
    const { marketId } = useParams<{ marketId: string }>();
    const navigate = useNavigate();
    const { webApp } = useTelegramApp();
    const { data: market, isLoading, error } = useMarket(marketId!);

    useEffect(() => {
        if (webApp) {
            webApp.BackButton.show();
            const handleBack = () => navigate(-1);
            webApp.BackButton.onClick(handleBack);
            return () => {
                webApp.BackButton.offClick(handleBack);
                webApp.BackButton.hide();
            };
        }
    }, [webApp, navigate]);

    if (isLoading) {
        return (
            <div className="container">
                <div className="loading">
                    <div className="loading-spinner" />
                </div>
            </div>
        );
    }

    if (error || !market) {
        return (
            <div className="container">
                <div className="error-state card">
                    <p>Market not found</p>
                </div>
            </div>
        );
    }

    const location = LOCATIONS[market.location];
    const isSettled = market.status === 'settled';
    const isBracket = market.marketType === 'bracket';
    const isScalar = market.marketType === 'scalar';

    const settlementDate = new Date(market.settlementTime * 1000);
    const now = new Date();
    const daysUntilSettlement = Math.ceil((settlementDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const getMarketTypeLabel = () => {
        if (isBracket) return 'BRACKET';
        if (isScalar) return 'SCALAR';
        return 'BINARY';
    };

    const renderBinaryStats = () => (
        <div className="market-stats-row">
            <div className="stat-item">
                <span className="label text-xs">Prob. Yes</span>
                <span className="value text-xl text-cyan">{formatPercent(market.yesPrice)}</span>
            </div>
            <div className="stat-item">
                <span className="label text-xs">Prob. No</span>
                <span className="value text-xl text-orange">{formatPercent(market.noPrice)}</span>
            </div>
            <div className="stat-item">
                <span className="label text-xs">Volume</span>
                <span className="value text-mono">{formatTon(market.totalCollateral)}</span>
            </div>
        </div>
    );

    const renderBracketStats = () => {
        const brackets = market.brackets || [];
        const totalStaked = brackets.reduce((sum, b) => sum + Number(b.totalStaked), 0);

        return (
            <div className="bracket-stats">
                <div className="bracket-distribution">
                    {brackets.map((bracket, idx) => {
                        const probability = totalStaked > 0
                            ? Number(bracket.totalStaked) / totalStaked
                            : 1 / brackets.length;
                        const widthPct = Math.max(probability * 100, 2);

                        return (
                            <div key={bracket.id} className="bracket-bar-item">
                                <div className="bracket-bar-header">
                                    <span className="bracket-range text-mono text-xs">{bracket.label}</span>
                                    <span className="bracket-pct text-mono">{formatPercent(probability)}</span>
                                </div>
                                <div className="bracket-bar-track">
                                    <div
                                        className={`bracket-bar-fill rank-${idx + 1}`}
                                        style={{ width: `${widthPct}%` }}
                                    />
                                </div>
                                <div className="bracket-staked text-hint text-xs">
                                    {formatTon(bracket.totalStaked)} staked
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="bracket-volume-row">
                    <span className="label text-xs">Total Volume</span>
                    <span className="value text-mono">{formatTon(market.totalCollateral)}</span>
                </div>
            </div>
        );
    };

    const renderScalarStats = () => (
        <div className="scalar-stats">
            <div className="scalar-expected">
                <span className="label text-xs">Expected Value</span>
                <span className="value text-xl text-gold">{formatTemperature(market.threshold)}</span>
            </div>
            <div className="market-stats-row">
                <div className="stat-item">
                    <span className="label text-xs">Long</span>
                    <span className="value text-xl text-success">{formatPercent(market.yesPrice)}</span>
                </div>
                <div className="stat-item">
                    <span className="label text-xs">Short</span>
                    <span className="value text-xl text-danger">{formatPercent(market.noPrice)}</span>
                </div>
                <div className="stat-item">
                    <span className="label text-xs">Volume</span>
                    <span className="value text-mono">{formatTon(market.totalCollateral)}</span>
                </div>
            </div>
        </div>
    );

    const renderSettlement = () => {
        if (isBracket && market.winningBracket !== undefined) {
            const winningBracket = market.brackets?.find((_, idx) => idx === market.winningBracket);
            return (
                <section className="settlement-section glass-panel">
                    <h4 className="section-title">Settlement</h4>
                    <div className="settlement-result bracket-settlement">
                        <div className="winning-bracket-badge">
                            <span className="bracket-label">{winningBracket?.label || `Bracket ${market.winningBracket}`}</span>
                        </div>
                        <p className="observed-value">
                            Observed: {formatTemperature(market.observedValue ?? 0)}
                        </p>
                        <p className="settlement-date">
                            Settled on {formatDate(market.settledAt ?? 0)}
                        </p>
                    </div>
                </section>
            );
        }

        return (
            <section className="settlement-section glass-panel">
                <h4 className="section-title">Settlement</h4>
                <div className="settlement-result">
                    <div className={`outcome-badge ${market.outcome?.toLowerCase()}`}>
                        {market.outcome}
                    </div>
                    <p className="observed-value">
                        Observed: {formatTemperature(market.observedValue ?? 0)}
                    </p>
                    <p className="settlement-date">
                        Settled on {formatDate(market.settledAt ?? 0)}
                    </p>
                </div>
            </section>
        );
    };

    return (
        <div className={`container market-detail-container market-type-${market.marketType}`}>
            <header className="market-detail-header glass-panel">
                <div className="header-mesh-bg"></div>
                <div className="market-location-info">
                    <div className="location-group">
                        <span className="location-icon">📍</span>
                        <h2 className="market-location-name text-glow">{location?.fullName || market.location}</h2>
                    </div>
                    <div className="header-badges">
                        <div className={`market-type-badge ${market.marketType}`}>
                            {getMarketTypeLabel()}
                        </div>
                        <div className={`status-badge ${market.status}`}>
                            {market.status.toUpperCase()}
                        </div>
                    </div>
                </div>
                <h3 className="question-title">{market.question}</h3>

                <div className="market-countdown text-mono">
                    <span className="icon">⏱</span> {daysUntilSettlement}d until settlement
                </div>
            </header>

            <section className="pressure-curve-section glass-panel">
                <div className="chart-header">
                    <span className="chart-title text-xs text-hint">
                        {isBracket ? 'BRACKET DISTRIBUTION' : isScalar ? 'SCALAR RANGE' : 'PRESSURE CURVE'}
                    </span>
                    <span className="live-indicator">LIVE</span>
                </div>
                {!isBracket && (
                    <div className="chart-viz">
                        <div className="pressure-gradient"></div>
                        <div className="pressure-line"></div>
                    </div>
                )}
                {isBracket && renderBracketStats()}
                {isScalar && renderScalarStats()}
                {!isBracket && !isScalar && renderBinaryStats()}
            </section>

            {isSettled ? (
                renderSettlement()
            ) : (
                <section className="trade-section glass-panel">
                    <h4 className="section-title">
                        {isBracket ? 'Select Bracket' : isScalar ? 'Place Trade' : 'Place Trade'}
                    </h4>
                    {!isBracket && (
                        <div className="conviction-slider-container">
                            <div className="slider-track-visual"></div>
                        </div>
                    )}
                    <TradeForm market={market} />
                </section>
            )}

            <section className="market-stats-section glass-panel">
                <h4 className="section-title text-hint">Market Details</h4>
                <div className="stats-grid text-sm">
                    {!isBracket && (
                        <div className="stat-box">
                            <span className="stat-label">Threshold</span>
                            <span className="stat-value text-mono">{formatTemperature(market.threshold)}</span>
                        </div>
                    )}
                    {isBracket && (
                        <div className="stat-box">
                            <span className="stat-label">Brackets</span>
                            <span className="stat-value text-mono">{market.brackets?.length || 0}</span>
                        </div>
                    )}
                    <div className="stat-box">
                        <span className="stat-label">Settlement</span>
                        <span className="stat-value text-mono">{formatDate(market.settlementTime)}</span>
                    </div>
                    {!isBracket && (
                        <>
                            <div className="stat-box">
                                <span className="stat-label">{isScalar ? 'Long Supply' : 'YES Supply'}</span>
                                <span className="stat-value text-mono">{formatTon(market.yesSupply)}</span>
                            </div>
                            <div className="stat-box">
                                <span className="stat-label">{isScalar ? 'Short Supply' : 'NO Supply'}</span>
                                <span className="stat-value text-mono">{formatTon(market.noSupply)}</span>
                            </div>
                        </>
                    )}
                    <div className="stat-box">
                        <span className="stat-label">Bettors</span>
                        <span className="stat-value text-mono">{market.uniqueBettors}</span>
                    </div>
                </div>
            </section>

            <MarketRulesCard market={market} />
        </div>
    );
}

export default MarketDetailPage;
