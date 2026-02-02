import { Link } from 'react-router-dom';
import { formatTon, formatPercent } from '../utils/format';
import MarketTypeBadge from './MarketTypeBadge';
import type { FeaturedMarket } from '../types';
import './HotMarketsCarousel.css';

interface HotMarketsCarouselProps {
    markets: FeaturedMarket[];
    title?: string;
    subtitle?: string;
}

function HotMarketsCarousel({ markets, title, subtitle }: HotMarketsCarouselProps) {
    if (!markets.length) return null;

    return (
        <section className="hot-markets-carousel">
            {(title || subtitle) && (
                <div className="carousel-header">
                    {title && <h3 className="carousel-title">{title}</h3>}
                    {subtitle && <p className="carousel-subtitle text-hint">{subtitle}</p>}
                </div>
            )}

            <div className="carousel-track">
                {markets.map((market) => (
                    <QuickPickCard key={market.id} market={market} />
                ))}
            </div>
        </section>
    );
}

interface QuickPickCardProps {
    market: FeaturedMarket;
}

function QuickPickCard({ market }: QuickPickCardProps) {
    const settlementDate = new Date(market.settlementTime * 1000);
    const now = new Date();
    const hoursLeft = Math.max(0, Math.ceil((settlementDate.getTime() - now.getTime()) / (1000 * 60 * 60)));

    const isBracket = market.marketType === 'bracket';

    return (
        <Link to={`/markets/${market.id}`} className={`quick-pick-card market-type-${market.marketType}`}>
            <div className="pick-accent" />
            <div className="pick-content">
                <div className="pick-header">
                    <span className="pick-location text-mono">{market.location}</span>
                    <MarketTypeBadge type={market.marketType} size="sm" showLabel={false} />
                </div>

                <p className="pick-question">{market.question}</p>

                <div className="pick-odds">
                    {isBracket ? (
                        <span className="pick-brackets-count">
                            {market.brackets?.length || 0} brackets
                        </span>
                    ) : (
                        <>
                            <span className="pick-yes">
                                <img src="/assets/weather/clear.png" alt="Yes" className="icon-tiny-img" />
                                <span className="odds-value text-mono">{formatPercent(market.yesPrice)}</span>
                            </span>
                            <span className="pick-divider">·</span>
                            <span className="pick-no">
                                <img src="/assets/weather/cloudy.png" alt="No" className="icon-tiny-img" />
                                <span className="odds-value text-mono">{formatPercent(market.noPrice)}</span>
                            </span>
                        </>
                    )}
                </div>

                <div className="pick-footer">
                    <span className="pick-pool text-mono">{formatTon(market.totalCollateral)}</span>
                    <span className="pick-time">
                        {hoursLeft < 24 ? `${hoursLeft}h` : `${Math.floor(hoursLeft / 24)}d`}
                    </span>
                </div>
            </div>
        </Link>
    );
}

export default HotMarketsCarousel;
