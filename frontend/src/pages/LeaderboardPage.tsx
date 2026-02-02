import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTelegramApp } from '../hooks/useTelegramApp';
import { useCurrentUser } from '../hooks';
import { api } from '../services/api';
import { StreakBadge } from '../components/StreakDisplay';
import { PointsBadge } from '../components/PointsDisplay';
import type { LeaderboardEntry } from '../types';
import './LeaderboardPage.css';

type LeaderboardType = 'points' | 'streaks';
type TimeFrame = 'all' | 'weekly' | 'monthly';

function LeaderboardPage() {
    const { t } = useTranslation();
    const { user: telegramUser } = useTelegramApp();
    const telegramId = telegramUser?.id;
    const { data: currentUser } = useCurrentUser(telegramId);

    const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('points');
    const [timeFrame, setTimeFrame] = useState<TimeFrame>('all');

    const { data: pointsLeaderboard, isLoading: pointsLoading } = useQuery({
        queryKey: ['leaderboard', 'points', timeFrame],
        queryFn: () => api.getPointsLeaderboard(50, timeFrame),
    });

    const { data: streakLeaderboard, isLoading: streakLoading } = useQuery({
        queryKey: ['leaderboard', 'streaks'],
        queryFn: () => api.getStreakLeaderboard(50),
    });

    const isLoading = leaderboardType === 'points' ? pointsLoading : streakLoading;
    const leaderboard = leaderboardType === 'points' ? pointsLeaderboard : streakLeaderboard;

    const currentUserRank = leaderboard?.findIndex(
        (entry) => entry.userId === currentUser?.id
    );

    return (
        <div className="container leaderboard-page">
            <header className="page-header">
                <h1 className="page-title">{t('leaderboard.title')}</h1>
                <div className="leaderboard-tabs">
                    <button
                        className={`tab-btn ${leaderboardType === 'points' ? 'active' : ''}`}
                        onClick={() => setLeaderboardType('points')}
                    >
                        <span className="tab-icon">✨</span>
                        <span>{t('leaderboard.points')}</span>
                    </button>
                    <button
                        className={`tab-btn ${leaderboardType === 'streaks' ? 'active' : ''}`}
                        onClick={() => setLeaderboardType('streaks')}
                    >
                        <span className="tab-icon">🔥</span>
                        <span>{t('leaderboard.streaks')}</span>
                    </button>
                </div>
            </header>

            {leaderboardType === 'points' && (
                <div className="timeframe-filters">
                    {(['all', 'weekly', 'monthly'] as TimeFrame[]).map((tf) => (
                        <button
                            key={tf}
                            className={`filter-btn ${timeFrame === tf ? 'active' : ''}`}
                            onClick={() => setTimeFrame(tf)}
                        >
                            {t(`leaderboard.timeframes.${tf}`)}
                        </button>
                    ))}
                </div>
            )}

            {currentUser && currentUserRank !== undefined && currentUserRank >= 0 && (
                <div className="your-rank glass-panel">
                    <span className="rank-label">{t('leaderboard.yourRank')}</span>
                    <span className="rank-value text-mono">#{currentUserRank + 1}</span>
                </div>
            )}

            <div className="leaderboard-content glass-panel">
                {isLoading ? (
                    <div className="loading">
                        <div className="loading-spinner" />
                    </div>
                ) : !leaderboard?.length ? (
                    <div className="empty-state">
                        <p className="text-hint">{t('leaderboard.noEntries')}</p>
                    </div>
                ) : (
                    <>
                        <div className="podium">
                            {leaderboard.slice(0, 3).map((entry, index) => (
                                <PodiumEntry
                                    key={entry.rank}
                                    entry={entry}
                                    position={(index + 1) as 1 | 2 | 3}
                                    type={leaderboardType}
                                    isCurrentUser={entry.userId === currentUser?.id}
                                />
                            ))}
                        </div>

                        <div className="leaderboard-list">
                            {leaderboard.slice(3).map((entry) => (
                                <LeaderboardRow
                                    key={entry.rank}
                                    entry={entry}
                                    type={leaderboardType}
                                    isCurrentUser={entry.userId === currentUser?.id}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

interface PodiumEntryProps {
    entry: LeaderboardEntry;
    position: 1 | 2 | 3;
    type: LeaderboardType;
    isCurrentUser?: boolean;
}

function PodiumEntry({ entry, position, type, isCurrentUser }: PodiumEntryProps) {
    const medals = ['🥇', '🥈', '🥉'];
    const heights = ['h-1', 'h-2', 'h-3'];

    return (
        <div
            className={`podium-entry ${heights[position - 1]} ${isCurrentUser ? 'current-user' : ''}`}
            style={{ order: position === 1 ? 2 : position === 2 ? 1 : 3 }}
        >
            <div className="podium-medal">{medals[position - 1]}</div>
            <div className="podium-avatar">
                {entry.avatarUrl ? (
                    <img src={entry.avatarUrl} alt={entry.displayName} />
                ) : (
                    <span className="avatar-placeholder">
                        {entry.displayName.charAt(0).toUpperCase()}
                    </span>
                )}
            </div>
            <span className="podium-name">{entry.displayName}</span>
            <div className="podium-value">
                {type === 'points' ? (
                    <PointsBadge balance={entry.value} />
                ) : (
                    <StreakBadge streak={entry.value} />
                )}
            </div>
            <div className="podium-stand" />
        </div>
    );
}

interface LeaderboardRowProps {
    entry: LeaderboardEntry;
    type: LeaderboardType;
    isCurrentUser?: boolean;
}

function LeaderboardRow({ entry, type, isCurrentUser }: LeaderboardRowProps) {
    return (
        <div className={`leaderboard-row ${isCurrentUser ? 'current-user' : ''}`}>
            <span className="row-rank text-mono">#{entry.rank}</span>
            <div className="row-user">
                <div className="row-avatar">
                    {entry.avatarUrl ? (
                        <img src={entry.avatarUrl} alt={entry.displayName} />
                    ) : (
                        <span className="avatar-placeholder">
                            {entry.displayName.charAt(0).toUpperCase()}
                        </span>
                    )}
                </div>
                <span className="row-name">{entry.displayName}</span>
            </div>
            <div className="row-value">
                {type === 'points' ? (
                    <span className="points-value text-mono">
                        {entry.value.toLocaleString()}
                        <span className="value-icon">✨</span>
                    </span>
                ) : (
                    <span className="streak-value text-mono">
                        {entry.value}
                        <span className="value-icon">🔥</span>
                    </span>
                )}
            </div>
        </div>
    );
}

export default LeaderboardPage;
