import { useTranslation } from 'react-i18next';
import { PRODUCT_LINE_CONFIGS } from '../types';
import type { ProductLine } from '../types';
import './ProductLineChips.css';

interface ProductLineChipsProps {
    selected: ProductLine | 'all';
    onChange: (line: ProductLine | 'all') => void;
}

function ProductLineChips({ selected, onChange }: ProductLineChipsProps) {
    const { t } = useTranslation();

    return (
        <div className="product-line-chips">
            <button
                className={`chip ${selected === 'all' ? 'active' : ''}`}
                onClick={() => onChange('all')}
            >
                <div className="chip-icon-wrapper">
                    <img src="/assets/weather/globe.png" alt="All" className="chip-icon-img" />
                </div>
                <span className="chip-label">{t('productLines.all')}</span>
            </button>
            {PRODUCT_LINE_CONFIGS.map((config) => (
                <button
                    key={config.id}
                    className={`chip ${selected === config.id ? 'active' : ''}`}
                    onClick={() => onChange(config.id)}
                    style={{
                        '--chip-color': config.color,
                        '--chip-shadow': config.shadowVar,
                    } as React.CSSProperties}
                >
                    <div className="chip-icon-wrapper">
                        {config.icon.includes('/') ? (
                            <img src={config.icon} alt="" className="chip-icon-img" />
                        ) : (
                            <span className="chip-icon">{config.icon}</span>
                        )}
                    </div>
                    <span className="chip-label">{t(config.nameKey)}</span>
                </button>
            ))}
        </div>
    );
}

export default ProductLineChips;
