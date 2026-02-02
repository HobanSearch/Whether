import { useTranslation } from 'react-i18next';
import type { MarketType } from '../types';
import { getMarketTypeConfig } from '../types';
import './MarketTypeBadge.css';

interface MarketTypeBadgeProps {
    type: MarketType;
    size?: 'sm' | 'md' | 'lg';
    showIcon?: boolean;
    showLabel?: boolean;
}

function MarketTypeBadge({ type, size = 'sm', showIcon = true, showLabel = true }: MarketTypeBadgeProps) {
    const { t } = useTranslation();
    const config = getMarketTypeConfig(type);

    return (
        <span
            className={`market-type-badge market-type-${type} size-${size}`}
            style={{
                '--badge-color': config.color,
                '--badge-shadow': config.shadowVar,
            } as React.CSSProperties}
        >
            {showIcon && (
                config.icon.includes('/') ? (
                    <img src={config.icon} alt="" className="badge-icon-img" />
                ) : (
                    <span className="badge-icon">{config.icon}</span>
                )
            )}
            {showLabel && <span className="badge-label">{t(config.labelKey)}</span>}
        </span>
    );
}

export default MarketTypeBadge;
