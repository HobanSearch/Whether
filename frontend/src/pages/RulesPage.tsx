/**
 * RulesPage Component
 *
 * Platform-wide rules page similar to Polymarket/Kalshi
 * Displays all trading rules, resolution procedures, and platform policies.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegramApp } from '../hooks/useTelegramApp';
import {
    PRODUCT_LINE_RULES,
    MARKET_TYPE_RULES,
    RESOLUTION_TYPE_RULES,
    ORACLE_CONFIG,
    RESOLUTION_SOURCES,
    SETTLEMENT_TIMELINE,
    getAllCategories,
    getRulesByCategory,
} from '../data/marketRules';
import type { ProductLine, MarketType, ResolutionType } from '../types';
import './RulesPage.css';

type TabType = 'general' | 'markets' | 'settlement' | 'data';

function RulesPage() {
    const navigate = useNavigate();
    const { webApp } = useTelegramApp();
    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

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

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionId)) {
                next.delete(sectionId);
            } else {
                next.add(sectionId);
            }
            return next;
        });
    };

    const categories = getAllCategories();

    const renderGeneralTab = () => (
        <div className="rules-tab-content">
            <section className="rules-intro">
                <h2>Platform Rules</h2>
                <p>
                    Whether is a weather prediction market platform built on TON blockchain.
                    All markets are settled using official weather data from recognized
                    meteorological sources through our decentralized oracle network.
                </p>
            </section>

            {categories.map(category => (
                <section key={category} className="rules-category">
                    <h3 className="category-title">{category}</h3>
                    <div className="rules-cards">
                        {getRulesByCategory(category).map((rule, idx) => (
                            <div key={idx} className="rule-card glass-panel">
                                <h4 className="rule-title">{rule.title}</h4>
                                <p className="rule-content">{rule.content}</p>
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );

    const renderMarketsTab = () => (
        <div className="rules-tab-content">
            {/* Market Types */}
            <section className="rules-section-group">
                <h2>Market Types</h2>
                <div className="market-types-grid">
                    {(Object.keys(MARKET_TYPE_RULES) as MarketType[]).map(type => {
                        const rule = MARKET_TYPE_RULES[type];
                        const isExpanded = expandedSections.has(`market-${type}`);
                        return (
                            <div key={type} className="market-type-card glass-panel">
                                <button
                                    className="market-type-header"
                                    onClick={() => toggleSection(`market-${type}`)}
                                >
                                    <div className="market-type-info">
                                        <span className={`market-type-badge ${type}`}>{rule.name}</span>
                                    </div>
                                    <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="6 9 12 15 18 9" />
                                        </svg>
                                    </span>
                                </button>
                                <p className="market-type-description">{rule.description}</p>
                                {isExpanded && (
                                    <div className="market-type-details">
                                        <h5>How It Works</h5>
                                        <ul className="detail-list">
                                            {rule.howItWorks.map((item, idx) => (
                                                <li key={idx}>{item}</li>
                                            ))}
                                        </ul>
                                        <h5>Settlement Process</h5>
                                        <ul className="detail-list">
                                            {rule.settlementProcess.map((item, idx) => (
                                                <li key={idx}>{item}</li>
                                            ))}
                                        </ul>
                                        <h5>Examples</h5>
                                        <div className="examples-box">
                                            {rule.examples.map((example, idx) => (
                                                <code key={idx} className="example">{example}</code>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Product Lines */}
            <section className="rules-section-group">
                <h2>Product Lines</h2>
                <p className="section-description">
                    Markets are organized into product lines based on their use case and data requirements.
                </p>
                <div className="product-lines-grid">
                    {(Object.keys(PRODUCT_LINE_RULES) as ProductLine[]).map(line => {
                        const rule = PRODUCT_LINE_RULES[line];
                        const isExpanded = expandedSections.has(`product-${line}`);
                        return (
                            <div key={line} className="product-line-card glass-panel">
                                <button
                                    className="product-line-header"
                                    onClick={() => toggleSection(`product-${line}`)}
                                >
                                    <div className="product-line-info">
                                        <span
                                            className="product-badge"
                                            style={{ backgroundColor: rule.color + '20', color: rule.color }}
                                        >
                                            {rule.name}
                                        </span>
                                    </div>
                                    <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="6 9 12 15 18 9" />
                                        </svg>
                                    </span>
                                </button>
                                <p className="product-line-description">{rule.description}</p>
                                {isExpanded && (
                                    <div className="product-line-details">
                                        <div className="detail-block">
                                            <h5>Primary Use Case</h5>
                                            <p>{rule.primaryUseCase}</p>
                                        </div>
                                        <div className="detail-block">
                                            <h5>Typical Markets</h5>
                                            <ul className="detail-list">
                                                {rule.typicalMarkets.map((market, idx) => (
                                                    <li key={idx}>{market}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="detail-block">
                                            <h5>Resolution Types</h5>
                                            <div className="resolution-badges">
                                                {rule.resolutionTypes.map(type => (
                                                    <span key={type} className="resolution-badge">{type}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="detail-block">
                                            <h5>Settlement Notes</h5>
                                            <ul className="detail-list">
                                                {rule.settlementNotes.map((note, idx) => (
                                                    <li key={idx}>{note}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="detail-block risk-block">
                                            <h5>Risk Factors</h5>
                                            <ul className="risk-list">
                                                {rule.riskFactors.map((risk, idx) => (
                                                    <li key={idx}>{risk}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );

    const renderSettlementTab = () => (
        <div className="rules-tab-content">
            {/* Settlement Timeline */}
            <section className="rules-section-group">
                <h2>Settlement Timeline</h2>
                <p className="section-description">
                    All markets follow a standardized settlement process to ensure fair and accurate resolution.
                </p>
                <div className="settlement-timeline-container glass-panel">
                    {SETTLEMENT_TIMELINE.map((phase, idx) => (
                        <div key={idx} className="timeline-phase">
                            <div className="phase-marker">
                                <span className="phase-number">{idx + 1}</span>
                                {idx < SETTLEMENT_TIMELINE.length - 1 && <div className="phase-connector" />}
                            </div>
                            <div className="phase-content">
                                <div className="phase-header">
                                    <h4 className="phase-name">{phase.name}</h4>
                                    <span className="phase-duration">{phase.duration}</span>
                                </div>
                                <p className="phase-description">{phase.description}</p>
                                {phase.userAction && (
                                    <div className="phase-action">
                                        <span className="action-label">Your action:</span>
                                        <span className="action-text">{phase.userAction}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Oracle Network */}
            <section className="rules-section-group">
                <h2>Oracle Network</h2>
                <p className="section-description">
                    Market resolution is powered by our decentralized oracle network.
                </p>
                <div className="oracle-details-card glass-panel">
                    <div className="oracle-grid">
                        <div className="oracle-stat">
                            <span className="stat-label">Network Name</span>
                            <span className="stat-value">{ORACLE_CONFIG.name}</span>
                        </div>
                        <div className="oracle-stat">
                            <span className="stat-label">Consensus Method</span>
                            <span className="stat-value">{ORACLE_CONFIG.consensusMethod}</span>
                        </div>
                        <div className="oracle-stat">
                            <span className="stat-label">Reporter Count</span>
                            <span className="stat-value">{ORACLE_CONFIG.reporterCount} reporters</span>
                        </div>
                        <div className="oracle-stat">
                            <span className="stat-label">Dispute Window</span>
                            <span className="stat-value">{ORACLE_CONFIG.disputeWindow} hour</span>
                        </div>
                        <div className="oracle-stat">
                            <span className="stat-label">Settlement Delay</span>
                            <span className="stat-value">{ORACLE_CONFIG.settlementDelay} hours</span>
                        </div>
                    </div>
                    <div className="oracle-description">
                        <p>{ORACLE_CONFIG.description}</p>
                    </div>
                </div>
            </section>

            {/* Dispute Process */}
            <section className="rules-section-group">
                <h2>Dispute Process</h2>
                <div className="dispute-info glass-panel">
                    <div className="dispute-steps">
                        <div className="dispute-step">
                            <span className="step-number">1</span>
                            <div className="step-content">
                                <h5>Identify Issue</h5>
                                <p>Review the settlement data and identify any discrepancies with official sources.</p>
                            </div>
                        </div>
                        <div className="dispute-step">
                            <span className="step-number">2</span>
                            <div className="step-content">
                                <h5>Submit Dispute</h5>
                                <p>Submit your dispute within the 1-hour dispute window with supporting evidence.</p>
                            </div>
                        </div>
                        <div className="dispute-step">
                            <span className="step-number">3</span>
                            <div className="step-content">
                                <h5>Dispute Bond</h5>
                                <p>Post a dispute bond (refunded if your dispute is successful).</p>
                            </div>
                        </div>
                        <div className="dispute-step">
                            <span className="step-number">4</span>
                            <div className="step-content">
                                <h5>Resolution</h5>
                                <p>Oracle council reviews the dispute and issues a final ruling.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );

    const renderDataTab = () => (
        <div className="rules-tab-content">
            {/* Data Sources */}
            <section className="rules-section-group">
                <h2>Data Sources</h2>
                <p className="section-description">
                    All market resolutions use official weather data from recognized meteorological agencies.
                </p>
                <div className="data-sources-grid">
                    {Object.entries(RESOLUTION_SOURCES).map(([key, source]) => (
                        <div key={key} className="data-source-card glass-panel">
                            <div className="source-header">
                                <h4 className="source-name">{source.name}</h4>
                                <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="source-link"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                        <polyline points="15 3 21 3 21 9" />
                                        <line x1="10" y1="14" x2="21" y2="3" />
                                    </svg>
                                </a>
                            </div>
                            <p className="source-description">{source.description}</p>
                            <div className="source-meta">
                                <div className="meta-item">
                                    <span className="meta-label">Update Frequency</span>
                                    <span className="meta-value">{source.updateFrequency}</span>
                                </div>
                                <div className="meta-item">
                                    <span className="meta-label">Data Format</span>
                                    <span className="meta-value">{source.dataFormat}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Resolution Types */}
            <section className="rules-section-group">
                <h2>Resolution Types</h2>
                <p className="section-description">
                    Different weather measurements used for market resolution.
                </p>
                <div className="resolution-types-grid">
                    {(Object.keys(RESOLUTION_TYPE_RULES) as ResolutionType[]).map(type => {
                        const rule = RESOLUTION_TYPE_RULES[type];
                        const isExpanded = expandedSections.has(`resolution-${type}`);
                        return (
                            <div key={type} className="resolution-type-card glass-panel">
                                <button
                                    className="resolution-type-header"
                                    onClick={() => toggleSection(`resolution-${type}`)}
                                >
                                    <div className="resolution-type-info">
                                        <span className="resolution-type-name">{rule.name}</span>
                                        <span className="resolution-type-unit">{rule.displayUnit}</span>
                                    </div>
                                    <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="6 9 12 15 18 9" />
                                        </svg>
                                    </span>
                                </button>
                                <p className="resolution-type-description">{rule.description}</p>
                                {isExpanded && (
                                    <div className="resolution-type-details">
                                        <div className="detail-row">
                                            <span className="detail-label">Internal Unit</span>
                                            <span className="detail-value">{rule.unit}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Data Source</span>
                                            <span className="detail-value">
                                                {RESOLUTION_SOURCES[rule.source]?.name || rule.source}
                                            </span>
                                        </div>
                                        <div className="detail-block">
                                            <span className="detail-label">Measurement Method</span>
                                            <p className="detail-text">{rule.measurementMethod}</p>
                                        </div>
                                        <div className="detail-block">
                                            <span className="detail-label">Examples</span>
                                            <div className="examples-box">
                                                {rule.examples.map((example, idx) => (
                                                    <code key={idx} className="example">{example}</code>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );

    return (
        <div className="container rules-page">
            <header className="rules-page-header">
                <h1 className="page-title text-glow">Platform Rules</h1>
                <p className="page-subtitle">Trading rules, resolution procedures, and platform policies</p>
            </header>

            <nav className="rules-tabs">
                <button
                    className={`tab-button ${activeTab === 'general' ? 'active' : ''}`}
                    onClick={() => setActiveTab('general')}
                >
                    General
                </button>
                <button
                    className={`tab-button ${activeTab === 'markets' ? 'active' : ''}`}
                    onClick={() => setActiveTab('markets')}
                >
                    Markets
                </button>
                <button
                    className={`tab-button ${activeTab === 'settlement' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settlement')}
                >
                    Settlement
                </button>
                <button
                    className={`tab-button ${activeTab === 'data' ? 'active' : ''}`}
                    onClick={() => setActiveTab('data')}
                >
                    Data
                </button>
            </nav>

            <main className="rules-main">
                {activeTab === 'general' && renderGeneralTab()}
                {activeTab === 'markets' && renderMarketsTab()}
                {activeTab === 'settlement' && renderSettlementTab()}
                {activeTab === 'data' && renderDataTab()}
            </main>
        </div>
    );
}

export default RulesPage;
