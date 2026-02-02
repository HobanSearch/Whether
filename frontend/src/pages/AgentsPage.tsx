import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgents, useAgentLeaderboard } from '../hooks';
import { useTelegramApp } from '../hooks/useTelegramApp';
import type { Agent, AgentStatus, AgentLeaderboardEntry } from '../types';
import './AgentsPage.css';

type TabType = 'my-agents' | 'leaderboard';

function AgentCard({ agent, onClick }: { agent: Agent; onClick: () => void }) {
    const getStatusColor = (status: AgentStatus) => {
        switch (status) {
            case 'active':
                return 'status-active';
            case 'paused':
                return 'status-paused';
            case 'stopped':
                return 'status-stopped';
            default:
                return 'status-pending';
        }
    };

    const formatPnl = (pnl: string) => {
        const value = parseFloat(pnl);
        if (value >= 0) return `+${value.toFixed(2)} TON`;
        return `${value.toFixed(2)} TON`;
    };

    return (
        <div className="agent-card glass-panel" onClick={onClick}>
            <div className="agent-header">
                <div className="agent-name-row">
                    <span className="agent-name">{agent.strategyName}</span>
                    <span className={`agent-status ${getStatusColor(agent.status)}`}>
                        {agent.status}
                    </span>
                </div>
                <p className="agent-thesis text-hint">
                    {agent.strategyConfig.thesis?.substring(0, 80)}
                    {(agent.strategyConfig.thesis?.length || 0) > 80 ? '...' : ''}
                </p>
            </div>

            <div className="agent-stats">
                <div className="stat">
                    <span className="stat-label">Win Rate</span>
                    <span className="stat-value">{(agent.winRate * 100).toFixed(1)}%</span>
                </div>
                <div className="stat">
                    <span className="stat-label">Trades</span>
                    <span className="stat-value">{agent.totalTrades}</span>
                </div>
                <div className="stat">
                    <span className="stat-label">PnL</span>
                    <span className={`stat-value ${parseFloat(agent.totalPnl) >= 0 ? 'positive' : 'negative'}`}>
                        {formatPnl(agent.totalPnl)}
                    </span>
                </div>
                <div className="stat">
                    <span className="stat-label">Accuracy</span>
                    <span className="stat-value">{((agent.predictionAccuracy ?? 0) * 100).toFixed(1)}%</span>
                </div>
            </div>
        </div>
    );
}

function LeaderboardRow({ entry, rank }: { entry: AgentLeaderboardEntry; rank: number }) {
    const navigate = useNavigate();

    const getRankClass = () => {
        if (rank === 1) return 'rank-gold';
        if (rank === 2) return 'rank-silver';
        if (rank === 3) return 'rank-bronze';
        return '';
    };

    return (
        <div
            className="leaderboard-row glass-panel"
            onClick={() => navigate(`/agents/${entry.agentId}`)}
        >
            <div className={`rank ${getRankClass()}`}>#{rank}</div>
            <div className="agent-info">
                <span className="agent-name">{entry.strategyName}</span>
                <span className="owner-name text-hint">by {entry.ownerUsername || 'Anonymous'}</span>
            </div>
            <div className="metrics">
                <div className="metric">
                    <span className="metric-label">Score</span>
                    <span className="metric-value">{entry.score.toFixed(0)}</span>
                </div>
                <div className="metric">
                    <span className="metric-label">Win Rate</span>
                    <span className="metric-value">{(entry.winRate * 100).toFixed(1)}%</span>
                </div>
                <div className="metric">
                    <span className="metric-label">PnL</span>
                    <span className={`metric-value ${parseFloat(entry.totalPnl) >= 0 ? 'positive' : 'negative'}`}>
                        {parseFloat(entry.totalPnl) >= 0 ? '+' : ''}{parseFloat(entry.totalPnl).toFixed(2)}
                    </span>
                </div>
            </div>
        </div>
    );
}

function AgentsPage() {
    const { user } = useTelegramApp();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('my-agents');
    const [statusFilter, setStatusFilter] = useState<AgentStatus | ''>('');
    const [period, setPeriod] = useState<'all_time' | 'weekly' | 'daily'>('all_time');

    const userId = user?.id?.toString();
    const { data: agents, isLoading: agentsLoading } = useAgents(
        userId,
        statusFilter || undefined
    );
    const { data: leaderboard, isLoading: leaderboardLoading } = useAgentLeaderboard(period);

    const renderMyAgents = () => {
        if (agentsLoading) {
            return (
                <div className="loading">
                    <div className="loading-spinner" />
                </div>
            );
        }

        return (
            <div className="my-agents-section">
                <div className="filters-row">
                    <select
                        className="status-filter"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as AgentStatus | '')}
                    >
                        <option value="">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="stopped">Stopped</option>
                    </select>
                    <button
                        className="btn btn-primary create-btn"
                        onClick={() => navigate('/agents/create')}
                    >
                        + Create Agent
                    </button>
                </div>

                {agents && agents.length > 0 ? (
                    <div className="agents-list">
                        {agents.map((agent) => (
                            <AgentCard
                                key={agent.id}
                                agent={agent}
                                onClick={() => navigate(`/agents/${agent.id}`)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="empty-state glass-panel">
                        <div className="empty-icon">🤖</div>
                        <h3>No Agents Yet</h3>
                        <p className="text-hint">
                            Create your first AI trading agent to start making predictions on weather markets.
                        </p>
                        <button
                            className="btn btn-primary"
                            onClick={() => navigate('/agents/create')}
                        >
                            Create Your First Agent
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const renderLeaderboard = () => {
        if (leaderboardLoading) {
            return (
                <div className="loading">
                    <div className="loading-spinner" />
                </div>
            );
        }

        return (
            <div className="leaderboard-section">
                <div className="period-toggle">
                    <button
                        className={`toggle-btn ${period === 'daily' ? 'active' : ''}`}
                        onClick={() => setPeriod('daily')}
                    >
                        Today
                    </button>
                    <button
                        className={`toggle-btn ${period === 'weekly' ? 'active' : ''}`}
                        onClick={() => setPeriod('weekly')}
                    >
                        This Week
                    </button>
                    <button
                        className={`toggle-btn ${period === 'all_time' ? 'active' : ''}`}
                        onClick={() => setPeriod('all_time')}
                    >
                        All Time
                    </button>
                </div>

                {leaderboard && leaderboard.length > 0 ? (
                    <div className="leaderboard-list">
                        {leaderboard.map((entry, index) => (
                            <LeaderboardRow
                                key={entry.agentId}
                                entry={entry}
                                rank={index + 1}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="empty-state glass-panel">
                        <p className="text-hint">No agents ranked yet</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="container agents-page">
            <header className="page-header">
                <h1 className="page-title">AI Agents</h1>
                <p className="page-subtitle text-hint">
                    Autonomous trading agents powered by AI weather analysis
                </p>
            </header>

            <nav className="tabs-nav">
                <button
                    className={`tab-btn ${activeTab === 'my-agents' ? 'active' : ''}`}
                    onClick={() => setActiveTab('my-agents')}
                >
                    My Agents
                </button>
                <button
                    className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
                    onClick={() => setActiveTab('leaderboard')}
                >
                    Leaderboard
                </button>
            </nav>

            <div className="tab-content">
                {activeTab === 'my-agents' && renderMyAgents()}
                {activeTab === 'leaderboard' && renderLeaderboard()}
            </div>
        </div>
    );
}

export default AgentsPage;
