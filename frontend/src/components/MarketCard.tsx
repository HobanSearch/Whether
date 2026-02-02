import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Market } from '../types';
import { formatTon, formatPercent, formatTemperature, getMarketIcons, safeBigIntToNumber } from '../utils/format';
import { useSettingsStore } from '../store/settings';
import MarketTypeBadge from './MarketTypeBadge';
import ForecastTooltip from './ForecastTooltip';
import './MarketCard.css';

interface MarketCardProps {
    market: Market;
}

function MarketCard({ market }: MarketCardProps) {
    const { t } = useTranslation();
    const { temperatureUnit } = useSettingsStore();
    const isBracket = market.marketType === 'bracket';
    const isScalar = market.marketType === 'scalar';

    const settlementDate = new Date(market.settlementTime * 1000);
    const now = new Date();
    const daysUntilSettlement = Math.ceil((settlementDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const renderBinaryOutcomes = () => {
        const icons = getMarketIcons(market.resolutionType);
        return (
            <div className="odds-container">
                <div className="outcome-btn yes">
                    <img src={icons.yesIcon} alt={icons.yesLabel} className="outcome-icon-img" />
                    <span className="outcome-label">{t('market.predictYes')}</span>
                    <span className="outcome-price">{formatPercent(market.yesPrice)}</span>
                </div>
                <div className="outcome-btn no">
                    <img src={icons.noIcon} alt={icons.noLabel} className="outcome-icon-img" />
                    <span className="outcome-label">{t('market.predictNo')}</span>
                    <span className="outcome-price">{formatPercent(market.noPrice)}</span>
                </div>
            </div>
        );
    };

    const renderBracketOutcomes = () => {
        const brackets = market.brackets || [];
        const topBrackets = brackets.slice(0, 3);

        return (
            <div className="bracket-outcomes">
                {topBrackets.map((bracket, idx) => {
                    const totalStaked = brackets.reduce(
                        (sum, b) => sum + safeBigIntToNumber(b.totalStaked),
                        0
                    );
                    const probability = totalStaked > 0
                        ? safeBigIntToNumber(bracket.totalStaked) / totalStaked
                        : 1 / brackets.length;

                    return (
                        <div key={bracket.id} className={`bracket-option rank-${idx + 1}`}>
                            <span className="bracket-label text-mono text-xs">
                                {bracket.label}
                            </span>
                            <span className="bracket-prob text-mono">
                                {formatPercent(probability)}
                            </span>
                        </div>
                    );
                })}
                {brackets.length > 3 && (
                    <span className="more-brackets text-hint text-xs">
                        +{brackets.length - 3}
                    </span>
                )}
            </div>
        );
    };

    const renderScalarOutcome = () => (
        <div className="scalar-outcome">
            <div className="scalar-range">
                <span className="range-label text-hint text-xs">{t('market.threshold')}</span>
                <span className="range-value text-mono text-glow">
                    {formatTemperature(market.threshold, temperatureUnit)}
                </span>
            </div>
            <div className="scalar-prices">
                <div className="outcome-btn yes">
                    <span className="outcome-label">LONG</span>
                    <span className="outcome-price">{formatPercent(market.yesPrice)}</span>
                </div>
                <div className="outcome-btn no">
                    <span className="outcome-label">SHORT</span>
                    <span className="outcome-price">{formatPercent(market.noPrice)}</span>
                </div>
            </div>
        </div>
    );

    const settlementDateStr = new Date(market.settlementTime * 1000).toISOString().split('T')[0];

    return (
        <Link to={`/markets/${market.id}`} className={`market-card glass-panel market-type-${market.marketType}`}>
            <div className="market-accent-bar" />
            <div className="market-content-wrapper">
                <div className="market-intro">
                    <div className="location-badge text-mono">
                        <span className="location-code">{market.location}</span>
                        <span className={`status-dot ${market.status}`}></span>
                        <MarketTypeBadge type={market.marketType} size="sm" showLabel={false} />
                    </div>
                    <h3 className="market-question-text">{market.question}</h3>
                    <div className="market-meta text-hint text-sm">
                        {isBracket ? (
                            <span>{market.brackets?.length || 0} brackets</span>
                        ) : (
                            <span>{t('market.threshold')}: {formatTemperature(market.threshold, temperatureUnit)}</span>
                        )}
                        <span className="meta-divider">·</span>
                        <span>{daysUntilSettlement}d</span>
                        <span className="meta-divider">·</span>
                        <ForecastTooltip
                            locationId={market.locationId}
                            locationCode={market.location}
                            settlementDate={settlementDateStr}
                            threshold={market.threshold}
                        >
                            <span className="forecast-peek-trigger">
                                <img src="/assets/weather/crystal_ball.png" alt="Peek" className="icon-tiny-img" />
                                {t('market.forecastPeek')}
                            </span>
                        </ForecastTooltip>
                    </div>
                </div>

                <div className="market-viz">
                    <img src="/sparkline.png" alt="Trend" className="sparkline-img" />
                </div>

                <div className="market-actions">
                    {isBracket && renderBracketOutcomes()}
                    {isScalar && renderScalarOutcome()}
                    {!isBracket && !isScalar && renderBinaryOutcomes()}
                    <div className="market-footer-stats">
                        <span className="pool-size text-mono text-xs">
                            {formatTon(market.totalCollateral)}
                        </span>
                        <span className="forecasters-count text-mono text-xs">
                            {market.uniqueBettors} {t('markets.forecasters')}
                        </span>
                    </div>
                </div>
            </div>

            {market.status === 'settled' && market.outcome && (
                <div className="market-micro-copy text-sm settled">
                    <img src="/assets/weather/clear.png" alt="Settled" className="icon-tiny-img" />
                    {t('markets.status.settled')}: {market.outcome}
                    {market.observedValue !== undefined && ` (${formatTemperature(market.observedValue, temperatureUnit)})`}
                </div>
            )}
        </Link>
    );
}

export default MarketCard;
