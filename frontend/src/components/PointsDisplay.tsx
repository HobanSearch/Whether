import type { PointsInfo, PointsHistoryEntry, PointSource } from '../types';
import { POINT_SOURCE_LABELS } from '../types';
import './PointsDisplay.css';

interface PointsDisplayProps {
    points: PointsInfo;
    size?: 'sm' | 'md' | 'lg';
    showBreakdown?: boolean;
    onClaimDaily?: () => void;
    isDailyClaimLoading?: boolean;
}

function PointsDisplay({
    points,
    size = 'md',
    showBreakdown = false,
    onClaimDaily,
    isDailyClaimLoading = false,
}: PointsDisplayProps) {
    return (
        <div className={`points-display ${size}`}>
            <div className="points-header">
                <div className="points-balance">
                    <span className="balance-icon">✨</span>
                    <span className="balance-value text-mono">{points.balance.toLocaleString()}</span>
                    <span className="balance-label">points</span>
                </div>

                {points.tierMultiplier > 1 && (
                    <div className="tier-bonus">
                        <span className="bonus-value text-mono">{points.tierMultiplier}x</span>
                        <span className="bonus-label">tier bonus</span>
                    </div>
                )}
            </div>

            {points.dailyLoginAvailable && onClaimDaily && (
                <button
                    className="daily-claim-btn"
                    onClick={onClaimDaily}
                    disabled={isDailyClaimLoading}
                >
                    {isDailyClaimLoading ? (
                        <span>Claiming...</span>
                    ) : (
                        <>
                            <span className="claim-icon">🎁</span>
                            <span>Claim Daily Bonus</span>
                            {points.loginStreak > 0 && (
                                <span className="login-streak text-mono">
                                    {points.loginStreak} day streak
                                </span>
                            )}
                        </>
                    )}
                </button>
            )}

            {showBreakdown && (
                <div className="points-breakdown">
                    <div className="breakdown-header">Points Earned</div>
                    <div className="breakdown-grid">
                        <BreakdownItem label="From Bets" value={points.earnedBreakdown.bets} icon="🎲" />
                        <BreakdownItem label="From Wins" value={points.earnedBreakdown.wins} icon="🏆" />
                        <BreakdownItem label="Streak Bonuses" value={points.earnedBreakdown.streaks} icon="🔥" />
                        <BreakdownItem label="Referrals" value={points.earnedBreakdown.referrals} icon="👥" />
                        <BreakdownItem label="Achievements" value={points.earnedBreakdown.achievements} icon="🏅" />
                        <BreakdownItem label="Daily Login" value={points.earnedBreakdown.daily} icon="📅" />
                    </div>
                </div>
            )}

            {size !== 'sm' && (
                <div className="points-stats">
                    <div className="stat-item">
                        <span className="stat-value text-mono">{points.totalEarned.toLocaleString()}</span>
                        <span className="stat-label">Total Earned</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value text-mono">{points.loginStreak}</span>
                        <span className="stat-label">Login Streak</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value text-mono">{points.bestLoginStreak}</span>
                        <span className="stat-label">Best Streak</span>
                    </div>
                </div>
            )}
        </div>
    );
}

interface BreakdownItemProps {
    label: string;
    value: number;
    icon: string;
}

function BreakdownItem({ label, value, icon }: BreakdownItemProps) {
    return (
        <div className="breakdown-item">
            <span className="item-icon">{icon}</span>
            <span className="item-label">{label}</span>
            <span className="item-value text-mono">{value.toLocaleString()}</span>
        </div>
    );
}

interface PointsHistoryListProps {
    entries: PointsHistoryEntry[];
    isLoading?: boolean;
}

export function PointsHistoryList({ entries, isLoading = false }: PointsHistoryListProps) {
    if (isLoading) {
        return <div className="points-history-loading">Loading history...</div>;
    }

    if (entries.length === 0) {
        return <div className="points-history-empty">No points history yet</div>;
    }

    return (
        <div className="points-history-list">
            {entries.map((entry) => (
                <PointsHistoryItem key={entry.id} entry={entry} />
            ))}
        </div>
    );
}

interface PointsHistoryItemProps {
    entry: PointsHistoryEntry;
}

function PointsHistoryItem({ entry }: PointsHistoryItemProps) {
    const isPositive = entry.amount > 0;
    const sourceLabel = POINT_SOURCE_LABELS[entry.source as PointSource] || entry.source;
    const formattedDate = new Date(entry.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });

    return (
        <div className="history-item">
            <div className="history-info">
                <span className="history-source">{sourceLabel}</span>
                {entry.description && (
                    <span className="history-description">{entry.description}</span>
                )}
                <span className="history-date text-hint">{formattedDate}</span>
            </div>
            <div className="history-amount">
                <span className={`amount-value text-mono ${isPositive ? 'positive' : 'negative'}`}>
                    {isPositive ? '+' : ''}{entry.amount.toLocaleString()}
                </span>
                {entry.streakMultiplier && entry.streakMultiplier > 1 && (
                    <span className="amount-multiplier text-hint">
                        ({entry.streakMultiplier}x streak)
                    </span>
                )}
            </div>
        </div>
    );
}

interface PointsBadgeProps {
    balance: number;
    size?: 'sm' | 'md';
}

export function PointsBadge({ balance, size = 'md' }: PointsBadgeProps) {
    return (
        <div className={`points-badge ${size}`}>
            <span className="badge-icon">✨</span>
            <span className="badge-value text-mono">{balance.toLocaleString()}</span>
        </div>
    );
}

interface DailyLoginRewardProps {
    baseAmount: number;
    streakBonus: number;
    totalAwarded: number;
    loginStreak: number;
    onClose?: () => void;
}

export function DailyLoginReward({
    baseAmount,
    streakBonus,
    totalAwarded,
    loginStreak,
    onClose,
}: DailyLoginRewardProps) {
    return (
        <div className="daily-login-reward">
            <div className="reward-header">
                <span className="reward-icon">🎁</span>
                <span className="reward-title">Daily Login Reward!</span>
                {onClose && (
                    <button className="reward-close" onClick={onClose}>×</button>
                )}
            </div>
            <div className="reward-content">
                <div className="reward-amount">
                    <span className="amount-value text-mono">+{totalAwarded}</span>
                    <span className="amount-label">points</span>
                </div>
                {streakBonus > 0 && (
                    <div className="reward-breakdown">
                        <span className="breakdown-base">Base: {baseAmount}</span>
                        <span className="breakdown-bonus">Streak bonus: +{streakBonus}</span>
                    </div>
                )}
                <div className="reward-streak">
                    <span className="streak-icon">📅</span>
                    <span className="streak-value">{loginStreak} day streak!</span>
                </div>
            </div>
        </div>
    );
}

export default PointsDisplay;
