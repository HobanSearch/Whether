import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    useAgent,
    useAgentPositions,
    useAgentPredictions,
    useAgentRank,
    usePauseAgent,
    useResumeAgent,
    useStopAgent,
} from '../hooks';
import { useTelegramApp } from '../hooks/useTelegramApp';
import type { AgentPosition, AgentPrediction, ConfidenceLevel } from '../types';
import './AgentDetailPage.css';

type TabType = 'overview' | 'positions' | 'predictions';

function PositionCard({ position }: { position: AgentPosition }) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open':
                return 'status-open';
            case 'closed':
                return 'status-closed';
            default:
                return 'status-pending';
        }
    };

    const formatPnl = (pnl: string | undefined) => {
        if (!pnl) return '-';
        const value = parseFloat(pnl);
        if (value >= 0) return `+${value.toFixed(4)} TON`;
        return `${value.toFixed(4)} TON`;
    };

    return (
        <div className="position-card glass-panel">
            <div className="position-header">
                <span className="market-question">{position.marketQuestion}</span>
                <span className={`position-status ${getStatusColor(position.status)}`}>
                    {position.status}
                </span>
            </div>
            <div className="position-details">
                <div className="detail">
                    <span className="detail-label">Direction</span>
                    <span className={`detail-value direction-${position.direction.toLowerCase()}`}>
                        {position.direction}
                    </span>
                </div>
                <div className="detail">
                    <span className="detail-label">Amount</span>
                    <span className="detail-value">{position.amount} TON</span>
                </div>
                <div className="detail">
                    <span className="detail-label">Entry</span>
                    <span className="detail-value">{(parseFloat(position.entryPrice) * 100).toFixed(1)}%</span>
                </div>
                {position.exitPrice && (
                    <div className="detail">
                        <span className="detail-label">Exit</span>
                        <span className="detail-value">{(parseFloat(position.exitPrice) * 100).toFixed(1)}%</span>
                    </div>
                )}
                {position.pnl && (
                    <div className="detail">
                        <span className="detail-label">PnL</span>
                        <span className={`detail-value ${parseFloat(position.pnl) >= 0 ? 'positive' : 'negative'}`}>
                            {formatPnl(position.pnl)}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

function PredictionCard({ prediction }: { prediction: AgentPrediction }) {
    const getConfidenceColor = (confidence: ConfidenceLevel) => {
        switch (confidence) {
            case 'very_high':
                return 'confidence-very-high';
            case 'high':
                return 'confidence-high';
            case 'medium':
                return 'confidence-medium';
            default:
                return 'confidence-low';
        }
    };

    const formatEdge = (edge: number) => {
        const pct = edge * 100;
        if (pct >= 0) return `+${pct.toFixed(1)}%`;
        return `${pct.toFixed(1)}%`;
    };

    return (
        <div className="prediction-card glass-panel">
            <div className="prediction-header">
                <span className="market-question">{prediction.marketQuestion}</span>
                {prediction.wasCorrect !== undefined && (
                    <span className={`prediction-result ${prediction.wasCorrect ? 'correct' : 'incorrect'}`}>
                        {prediction.wasCorrect ? '✓ Correct' : '✗ Wrong'}
                    </span>
                )}
            </div>

            <div className="probabilities">
                <div className="prob-comparison">
                    <div className="prob-item">
                        <span className="prob-label">Market</span>
                        <span className="prob-value">{(prediction.marketProbability * 100).toFixed(1)}%</span>
                    </div>
                    <div className="prob-arrow">→</div>
                    <div className="prob-item">
                        <span className="prob-label">AI Prediction</span>
                        <span className="prob-value highlight">{(prediction.predictedProbability * 100).toFixed(1)}%</span>
                    </div>
                </div>
                <div className="edge-badge">
                    Edge: <span className={prediction.edge >= 0 ? 'positive' : 'negative'}>{formatEdge(prediction.edge)}</span>
                </div>
            </div>

            <div className="prediction-meta">
                <span className={`confidence-badge ${getConfidenceColor(prediction.confidence)}`}>
                    {prediction.confidence.replace('_', ' ')} confidence
                </span>
                {prediction.recommendedDirection && (
                    <span className={`direction-badge direction-${prediction.recommendedDirection.toLowerCase()}`}>
                        Rec: {prediction.recommendedDirection}
                    </span>
                )}
            </div>

            <div className="reasoning">
                <p className="reasoning-text">{prediction.reasoning}</p>
                {prediction.weatherFactors.length > 0 && (
                    <div className="weather-factors">
                        {prediction.weatherFactors.map((factor, i) => (
                            <span key={i} className="factor-tag">{factor}</span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function AgentDetailPage() {
    useTelegramApp();
    const { agentId } = useParams<{ agentId: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [positionFilter, setPositionFilter] = useState<string>('');

    const { data: agent, isLoading: agentLoading } = useAgent(agentId);
    const { data: positions, isLoading: positionsLoading } = useAgentPositions(agentId, positionFilter || undefined);
    const { data: predictions, isLoading: predictionsLoading } = useAgentPredictions(agentId);
    const { data: rank } = useAgentRank(agentId);

    const pauseAgent = usePauseAgent();
    const resumeAgent = useResumeAgent();
    const stopAgent = useStopAgent();

    if (agentLoading) {
        return (
            <div className="container agent-detail-page">
                <div className="loading">
                    <div className="loading-spinner" />
                </div>
            </div>
        );
    }

    if (!agent) {
        return (
            <div className="container agent-detail-page">
                <div className="empty-state glass-panel">
                    <p>Agent not found</p>
                    <button className="btn btn-secondary" onClick={() => navigate('/agents')}>
                        Back to Agents
                    </button>
                </div>
            </div>
        );
    }

    const handlePause = () => {
        if (agentId) pauseAgent.mutate(agentId);
    };

    const handleResume = () => {
        if (agentId) resumeAgent.mutate(agentId);
    };

    const handleStop = () => {
        if (agentId && confirm('Are you sure you want to stop this agent? This cannot be undone.')) {
            stopAgent.mutate(agentId);
        }
    };

    const renderOverview = () => (
        <div className="overview-section">
            <div className="stats-grid">
                <div className="stat-card glass-panel">
                    <span className="stat-label">Total Trades</span>
                    <span className="stat-value">{agent.totalTrades}</span>
                </div>
                <div className="stat-card glass-panel">
                    <span className="stat-label">Win Rate</span>
                    <span className="stat-value">{(agent.winRate * 100).toFixed(1)}%</span>
                </div>
                <div className="stat-card glass-panel">
                    <span className="stat-label">Total PnL</span>
                    <span className={`stat-value ${parseFloat(agent.totalPnl) >= 0 ? 'positive' : 'negative'}`}>
                        {parseFloat(agent.totalPnl) >= 0 ? '+' : ''}{parseFloat(agent.totalPnl).toFixed(4)} TON
                    </span>
                </div>
                <div className="stat-card glass-panel">
                    <span className="stat-label">Prediction Accuracy</span>
                    <span className="stat-value">{((agent.predictionAccuracy ?? 0) * 100).toFixed(1)}%</span>
                </div>
            </div>

            {rank && (
                <div className="rank-section glass-panel">
                    <h3>Leaderboard Rank</h3>
                    <div className="rank-details">
                        <span className="rank-position">#{rank.rank}</span>
                        <span className="rank-context">of {rank.totalAgents} agents</span>
                        <span className="percentile">Top {rank.percentile.toFixed(1)}%</span>
                    </div>
                </div>
            )}

            <div className="strategy-section glass-panel">
                <h3>Strategy Configuration</h3>
                <div className="strategy-details">
                    <div className="strategy-item">
                        <span className="item-label">Thesis</span>
                        <p className="item-value">{agent.strategyConfig.thesis}</p>
                    </div>
                    <div className="strategy-item">
                        <span className="item-label">Market Types</span>
                        <div className="tags">
                            {agent.strategyConfig.marketSelection.types.map((type) => (
                                <span key={type} className="tag">{type}</span>
                            ))}
                        </div>
                    </div>
                    <div className="strategy-item">
                        <span className="item-label">Locations</span>
                        <div className="tags">
                            {agent.strategyConfig.marketSelection.locations.map((loc) => (
                                <span key={loc} className="tag">{loc}</span>
                            ))}
                        </div>
                    </div>
                    <div className="strategy-item">
                        <span className="item-label">Position Direction</span>
                        <span className="item-value">{agent.strategyConfig.positionDirection}</span>
                    </div>
                    <div className="strategy-item">
                        <span className="item-label">Risk Controls</span>
                        <p className="item-value">
                            Min confidence: {agent.strategyConfig.riskControls.minConfidence},
                            Min edge: {(agent.strategyConfig.riskControls.minEdge * 100).toFixed(1)}%
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderPositions = () => (
        <div className="positions-section">
            <div className="filters-row">
                <select
                    className="status-filter"
                    value={positionFilter}
                    onChange={(e) => setPositionFilter(e.target.value)}
                >
                    <option value="">All Positions</option>
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                    <option value="pending">Pending</option>
                </select>
            </div>

            {positionsLoading ? (
                <div className="loading">
                    <div className="loading-spinner" />
                </div>
            ) : positions && positions.length > 0 ? (
                <div className="positions-list">
                    {positions.map((position) => (
                        <PositionCard key={position.id} position={position} />
                    ))}
                </div>
            ) : (
                <div className="empty-state glass-panel">
                    <p className="text-hint">No positions yet</p>
                </div>
            )}
        </div>
    );

    const renderPredictions = () => (
        <div className="predictions-section">
            {predictionsLoading ? (
                <div className="loading">
                    <div className="loading-spinner" />
                </div>
            ) : predictions && predictions.length > 0 ? (
                <div className="predictions-list">
                    {predictions.map((prediction) => (
                        <PredictionCard key={prediction.id} prediction={prediction} />
                    ))}
                </div>
            ) : (
                <div className="empty-state glass-panel">
                    <p className="text-hint">No predictions yet</p>
                </div>
            )}
        </div>
    );

    return (
        <div className="container agent-detail-page">
            <header className="page-header">
                <button className="back-btn" onClick={() => navigate('/agents')}>
                    ← Back
                </button>
                <div className="header-content">
                    <h1 className="page-title">{agent.strategyName}</h1>
                    <span className={`agent-status status-${agent.status}`}>{agent.status}</span>
                </div>
            </header>

            <div className="action-buttons">
                {agent.status === 'active' && (
                    <button
                        className="btn btn-secondary"
                        onClick={handlePause}
                        disabled={pauseAgent.isPending}
                    >
                        Pause Agent
                    </button>
                )}
                {agent.status === 'paused' && (
                    <button
                        className="btn btn-primary"
                        onClick={handleResume}
                        disabled={resumeAgent.isPending}
                    >
                        Resume Agent
                    </button>
                )}
                {agent.status !== 'stopped' && (
                    <button
                        className="btn btn-danger"
                        onClick={handleStop}
                        disabled={stopAgent.isPending}
                    >
                        Stop Agent
                    </button>
                )}
            </div>

            <nav className="tabs-nav">
                <button
                    className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    Overview
                </button>
                <button
                    className={`tab-btn ${activeTab === 'positions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('positions')}
                >
                    Positions ({agent.totalTrades})
                </button>
                <button
                    className={`tab-btn ${activeTab === 'predictions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('predictions')}
                >
                    Predictions
                </button>
            </nav>

            <div className="tab-content">
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'positions' && renderPositions()}
                {activeTab === 'predictions' && renderPredictions()}
            </div>
        </div>
    );
}

export default AgentDetailPage;
