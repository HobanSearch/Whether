import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatTon, formatPercent, formatTemperature, getMarketIcons, safeBigIntToNumber } from '../utils/format';
import { useSettingsStore } from '../store/settings';
import MarketTypeBadge from './MarketTypeBadge';
import type { FeaturedMarket } from '../types';
import './FeaturedMarketHero.css';

interface FeaturedMarketHeroProps {
    market: FeaturedMarket;
}

function FeaturedMarketHero({ market }: FeaturedMarketHeroProps) {
    const { t } = useTranslation();
    const { temperatureUnit } = useSettingsStore();

    const isBracket = market.marketType === 'bracket';
    const isScalar = market.marketType === 'scalar';

    const settlementDate = new Date(market.settlementTime * 1000);
    const now = new Date();
    const hoursUntilSettlement = Math.ceil((settlementDate.getTime() - now.getTime()) / (1000 * 60 * 60));

    const renderOdds = () => {
        if (isBracket) {
            const brackets = market.brackets || [];
            const topBrackets = brackets.slice(0, 3);
            const totalStaked = brackets.reduce((sum, b) => sum + safeBigIntToNumber(b.totalStaked), 0);

            return (
                <div className="hero-brackets">
                    {topBrackets.map((bracket, idx) => {
                        const probability = totalStaked > 0
                            ? safeBigIntToNumber(bracket.totalStaked) / totalStaked
                            : 1 / brackets.length;

                        return (
                            <div key={bracket.id} className={`hero-bracket rank-${idx + 1}`}>
                                <span className="bracket-label">{bracket.label}</span>
                                <span className="bracket-odds">{formatPercent(probability)}</span>
                            </div>
                        );
                    })}
                </div>
            );
        }

        const icons = getMarketIcons(market.resolutionType);
        return (
            <div className="hero-binary-odds">
                <div className="hero-outcome yes">
                    <img src={icons.yesIcon} alt={icons.yesLabel} className="outcome-icon-img" />
                    <span className="outcome-label">{isScalar ? 'LONG' : t('market.predictYes')}</span>
                    <span className="outcome-odds text-mono">{formatPercent(market.yesPrice)}</span>
                </div>
                <div className="hero-outcome no">
                    <img src={icons.noIcon} alt={icons.noLabel} className="outcome-icon-img" />
                    <span className="outcome-label">{isScalar ? 'SHORT' : t('market.predictNo')}</span>
                    <span className="outcome-odds text-mono">{formatPercent(market.noPrice)}</span>
                </div>
            </div>
        );
    };

    return (
        <Link to={`/markets/${market.id}`} className={`featured-market-hero market-type-${market.marketType}`}>
            <div className="hero-accent-bar" />
            <div className="hero-content">
                <div className="hero-header">
                    <span className="storm-front-badge">{t('markets.stormFront')}</span>
                    <MarketTypeBadge type={market.marketType} size="sm" />
                </div>

                <h2 className="hero-question">{market.question}</h2>

                {!isBracket && (
                    <div className="hero-threshold">
                        <span className="threshold-label">{t('market.threshold')}:</span>
                        <span className="threshold-value text-mono text-glow">
                            {formatTemperature(market.threshold, temperatureUnit)}
                        </span>
                    </div>
                )}

                {renderOdds()}

                <div className="hero-footer">
                    <div className="hero-stats">
                        <div className="stat">
                            <span className="stat-label">{t('markets.poolSize')}</span>
                            <span className="stat-value text-mono">{formatTon(market.totalCollateral)}</span>
                        </div>
                        <div className="stat">
                            <span className="stat-label">{t('markets.forecasters')}</span>
                            <span className="stat-value text-mono">{market.uniqueBettors}</span>
                        </div>
                        <div className="stat">
                            <span className="stat-label">{t('time.endsIn')}</span>
                            <span className="stat-value text-mono">{hoursUntilSettlement}h</span>
                        </div>
                    </div>

                    <button className="hero-cta">
                        {t('market.backYourPrediction')}
                        <span className="cta-arrow">→</span>
                    </button>
                </div>
            </div>
        </Link>
    );
}

export default FeaturedMarketHero;
