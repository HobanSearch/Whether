import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { formatTemperatureF, formatPercent } from '../utils/format';
import './ForecastTooltip.css';

interface ForecastTooltipProps {
    locationId?: number;
    locationCode: string;
    settlementDate: string;
    threshold?: number;
    children: React.ReactNode;
}

function ForecastTooltip({
    locationCode,
    settlementDate,
    threshold,
    children,
}: ForecastTooltipProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    const { data: forecast, isLoading } = useQuery({
        queryKey: ['forecast', locationCode, settlementDate],
        queryFn: () => api.getForecast(locationCode, settlementDate),
        enabled: isOpen,
        staleTime: 5 * 60 * 1000,
    });

    const handleToggle = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    const getConfidenceLevel = (p10: number, p90: number): 'high' | 'medium' | 'low' => {
        const spread = p90 - p10;
        if (spread < 5) return 'high';
        if (spread < 10) return 'medium';
        return 'low';
    };

    const calculateExceedanceProb = (
        threshold: number,
        p10: number,
        p50: number,
        p90: number
    ): number => {
        if (threshold <= p10) return 95;
        if (threshold >= p90) return 5;
        if (threshold <= p50) {
            return 50 + ((p50 - threshold) / (p50 - p10)) * 45;
        }
        return 50 - ((threshold - p50) / (p90 - p50)) * 45;
    };

    return (
        <div className="forecast-tooltip-container">
            <button className="forecast-trigger" onClick={handleToggle}>
                {children}
            </button>

            {isOpen && (
                <>
                    <div className="tooltip-backdrop" onClick={() => setIsOpen(false)} />
                    <div className="forecast-tooltip glass-panel">
                        <div className="tooltip-header">
                            <span className="tooltip-title">
                                <span className="tooltip-icon">🔮</span>
                                {t('market.forecastPeek')}
                            </span>
                            <button className="tooltip-close" onClick={() => setIsOpen(false)}>
                                ×
                            </button>
                        </div>

                        {isLoading ? (
                            <div className="tooltip-loading">
                                <div className="loading-spinner" />
                            </div>
                        ) : forecast ? (
                            <div className="tooltip-content">
                                <div className="forecast-distribution">
                                    <div className="distribution-row">
                                        <span className="dist-label">{t('forecast.p10')}</span>
                                        <span className="dist-value text-mono">
                                            {formatTemperatureF(forecast.distribution.p10)}
                                        </span>
                                    </div>
                                    <div className="distribution-row highlight">
                                        <span className="dist-label">{t('forecast.p50')}</span>
                                        <span className="dist-value text-mono text-glow">
                                            {formatTemperatureF(forecast.distribution.p50)}
                                        </span>
                                    </div>
                                    <div className="distribution-row">
                                        <span className="dist-label">{t('forecast.p90')}</span>
                                        <span className="dist-value text-mono">
                                            {formatTemperatureF(forecast.distribution.p90)}
                                        </span>
                                    </div>
                                </div>

                                {threshold !== undefined && (
                                    <div className="exceedance-section">
                                        <span className="exceedance-label">
                                            {t('forecast.exceedanceProb')}
                                        </span>
                                        <span className="exceedance-value text-mono">
                                            {formatPercent(
                                                calculateExceedanceProb(
                                                    threshold,
                                                    forecast.distribution.p10,
                                                    forecast.distribution.p50,
                                                    forecast.distribution.p90
                                                ) / 100
                                            )}
                                        </span>
                                    </div>
                                )}

                                <div className="confidence-section">
                                    <span className="confidence-label">{t('market.aiConfidence')}</span>
                                    <ConfidenceBadge
                                        level={getConfidenceLevel(
                                            forecast.distribution.p10,
                                            forecast.distribution.p90
                                        )}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="tooltip-empty">
                                <p className="text-hint">{t('common.noResults')}</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

interface ConfidenceBadgeProps {
    level: 'high' | 'medium' | 'low';
}

function ConfidenceBadge({ level }: ConfidenceBadgeProps) {
    const labels = {
        high: 'High',
        medium: 'Medium',
        low: 'Low',
    };

    return (
        <span className={`confidence-badge confidence-${level}`}>
            {labels[level]}
        </span>
    );
}

export default ForecastTooltip;
