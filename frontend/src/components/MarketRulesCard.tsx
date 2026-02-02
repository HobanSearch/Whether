/**
 * MarketRulesCard Component
 *
 * Displays market rules, resolution criteria, and settlement information
 * similar to Polymarket/Kalshi rule sections.
 */

import { useState } from 'react';
import { Market } from '../types';
import {
    getResolutionTypeRule,
    getProductLineRule,
    getMarketTypeRule,
    parseResolutionCriteria,
    ORACLE_CONFIG,
    RESOLUTION_SOURCES,
    SETTLEMENT_TIMELINE,
} from '../data/marketRules';
import './MarketRulesCard.css';

interface MarketRulesCardProps {
    market: Market;
    expanded?: boolean;
}

function MarketRulesCard({ market, expanded = false }: MarketRulesCardProps) {
    const [isExpanded, setIsExpanded] = useState(expanded);

    const resolutionInfo = parseResolutionCriteria(
        `${market.resolutionType} ${market.comparisonType === 'gt' ? '>' : market.comparisonType === 'lt' ? '<' : '=='} ${market.threshold}`
    );

    const resolutionTypeRule = getResolutionTypeRule(market.resolutionType);
    const productLineRule = market.productLine ? getProductLineRule(market.productLine) : null;
    const marketTypeRule = getMarketTypeRule(market.marketType);

    const formatOperator = (op: string): string => {
        const operators: Record<string, string> = {
            '>': 'greater than',
            '<': 'less than',
            '>=': 'greater than or equal to',
            '<=': 'less than or equal to',
            '==': 'equal to',
            gt: 'greater than',
            lt: 'less than',
            gte: 'greater than or equal to',
            lte: 'less than or equal to',
            eq: 'equal to',
        };
        return operators[op] || op;
    };

    return (
        <section className="market-rules-card glass-panel">
            <button
                className="rules-header"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
            >
                <div className="rules-header-content">
                    <span className="rules-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                    </span>
                    <span className="rules-title">Market Rules & Resolution</span>
                </div>
                <span className={`rules-expand-icon ${isExpanded ? 'expanded' : ''}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </span>
            </button>

            {isExpanded && (
                <div className="rules-content">
                    {/* Resolution Criteria */}
                    <div className="rules-section">
                        <h5 className="rules-section-title">Resolution Criteria</h5>
                        <div className="resolution-criteria-box">
                            <div className="criteria-main">
                                <span className="criteria-label">This market resolves YES if:</span>
                                <p className="criteria-text">
                                    The observed <strong>{resolutionTypeRule.name.toLowerCase()}</strong> is{' '}
                                    <strong>{formatOperator(market.comparisonType)}</strong>{' '}
                                    <strong className="criteria-value">
                                        {resolutionInfo?.thresholdFormatted || market.threshold}
                                    </strong>
                                </p>
                            </div>
                            <div className="criteria-details">
                                <div className="criteria-detail-item">
                                    <span className="detail-label">Measurement Unit</span>
                                    <span className="detail-value">{resolutionTypeRule.unit}</span>
                                </div>
                                <div className="criteria-detail-item">
                                    <span className="detail-label">Data Source</span>
                                    <span className="detail-value">
                                        {RESOLUTION_SOURCES[resolutionTypeRule.source]?.name || resolutionTypeRule.source}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Market Type */}
                    <div className="rules-section">
                        <h5 className="rules-section-title">Market Type: {marketTypeRule.name}</h5>
                        <p className="rules-description">{marketTypeRule.description}</p>
                        <ul className="rules-list">
                            {marketTypeRule.howItWorks.map((item, idx) => (
                                <li key={idx} className="rules-list-item">
                                    <span className="list-bullet">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                            <circle cx="12" cy="12" r="4" />
                                        </svg>
                                    </span>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Product Line (if applicable) */}
                    {productLineRule && (
                        <div className="rules-section">
                            <h5 className="rules-section-title">
                                <span
                                    className="product-line-badge"
                                    style={{ backgroundColor: productLineRule.color + '20', color: productLineRule.color }}
                                >
                                    {productLineRule.name}
                                </span>
                                Market Category
                            </h5>
                            <p className="rules-description">{productLineRule.description}</p>
                            <div className="rules-notes">
                                <span className="notes-label">Settlement Notes:</span>
                                <ul className="notes-list">
                                    {productLineRule.settlementNotes.map((note, idx) => (
                                        <li key={idx}>{note}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Settlement Timeline */}
                    <div className="rules-section">
                        <h5 className="rules-section-title">Settlement Process</h5>
                        <div className="settlement-timeline">
                            {SETTLEMENT_TIMELINE.map((phase, idx) => (
                                <div key={idx} className="timeline-item">
                                    <div className="timeline-marker">
                                        <span className="timeline-number">{idx + 1}</span>
                                    </div>
                                    <div className="timeline-content">
                                        <span className="timeline-name">{phase.name}</span>
                                        <span className="timeline-duration">{phase.duration}</span>
                                        <p className="timeline-description">{phase.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Oracle Information */}
                    <div className="rules-section oracle-section">
                        <h5 className="rules-section-title">Oracle Network</h5>
                        <div className="oracle-info-grid">
                            <div className="oracle-info-item">
                                <span className="oracle-label">Network</span>
                                <span className="oracle-value">{ORACLE_CONFIG.name}</span>
                            </div>
                            <div className="oracle-info-item">
                                <span className="oracle-label">Consensus</span>
                                <span className="oracle-value">{ORACLE_CONFIG.consensusMethod}</span>
                            </div>
                            <div className="oracle-info-item">
                                <span className="oracle-label">Reporters</span>
                                <span className="oracle-value">{ORACLE_CONFIG.reporterCount} reporters</span>
                            </div>
                            <div className="oracle-info-item">
                                <span className="oracle-label">Dispute Window</span>
                                <span className="oracle-value">{ORACLE_CONFIG.disputeWindow} hour</span>
                            </div>
                        </div>
                    </div>

                    {/* Data Source Details */}
                    <div className="rules-section">
                        <h5 className="rules-section-title">Data Source</h5>
                        {RESOLUTION_SOURCES[resolutionTypeRule.source] && (
                            <div className="data-source-box">
                                <div className="source-header">
                                    <span className="source-name">
                                        {RESOLUTION_SOURCES[resolutionTypeRule.source].name}
                                    </span>
                                    <a
                                        href={RESOLUTION_SOURCES[resolutionTypeRule.source].url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="source-link"
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                            <polyline points="15 3 21 3 21 9" />
                                            <line x1="10" y1="14" x2="21" y2="3" />
                                        </svg>
                                        View Source
                                    </a>
                                </div>
                                <p className="source-description">
                                    {RESOLUTION_SOURCES[resolutionTypeRule.source].description}
                                </p>
                                <div className="source-details">
                                    <span className="source-detail">
                                        Updates: {RESOLUTION_SOURCES[resolutionTypeRule.source].updateFrequency}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Risk Factors (if product line) */}
                    {productLineRule && productLineRule.riskFactors.length > 0 && (
                        <div className="rules-section risk-section">
                            <h5 className="rules-section-title">
                                <span className="risk-icon">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                        <line x1="12" y1="9" x2="12" y2="13" />
                                        <line x1="12" y1="17" x2="12.01" y2="17" />
                                    </svg>
                                </span>
                                Risk Factors
                            </h5>
                            <ul className="risk-list">
                                {productLineRule.riskFactors.map((risk, idx) => (
                                    <li key={idx} className="risk-item">{risk}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Resolution Examples */}
                    <div className="rules-section">
                        <h5 className="rules-section-title">Resolution Examples</h5>
                        <div className="examples-list">
                            {resolutionTypeRule.examples.map((example, idx) => (
                                <div key={idx} className="example-item">
                                    <code className="example-code">{example}</code>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

export default MarketRulesCard;
