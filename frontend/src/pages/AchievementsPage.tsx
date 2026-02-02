import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTelegramApp } from '../hooks/useTelegramApp';
import { useCurrentUser } from '../hooks';
import { api } from '../services/api';
import AchievementBadge, { AchievementGrid } from '../components/AchievementBadge';
import type { Achievement, AchievementCategory, AchievementRarity } from '../types';
import './AchievementsPage.css';

type FilterCategory = AchievementCategory | 'all';
type FilterStatus = 'all' | 'unlocked' | 'locked';

function AchievementsPage() {
    const { t } = useTranslation();
    const { user: telegramUser } = useTelegramApp();
    const telegramId = telegramUser?.id;
    const { data: user } = useCurrentUser(telegramId);

    const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all');
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
    const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);

    const { data: achievements, isLoading } = useQuery({
        queryKey: ['achievements', user?.id],
        queryFn: () => api.getAchievements(user?.id),
        enabled: !!user?.id,
    });

    const { data: stats } = useQuery({
        queryKey: ['achievement-stats', user?.id],
        queryFn: () => api.getAchievementStats(user!.id),
        enabled: !!user?.id,
    });

    const filteredAchievements = achievements?.filter((a) => {
        if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
        if (statusFilter === 'unlocked' && !a.isUnlocked) return false;
        if (statusFilter === 'locked' && a.isUnlocked) return false;
        return true;
    });

    const groupedByRarity = filteredAchievements?.reduce((acc, achievement) => {
        const rarity = achievement.rarity;
        if (!acc[rarity]) acc[rarity] = [];
        acc[rarity].push(achievement);
        return acc;
    }, {} as Record<AchievementRarity, Achievement[]>);

    const rarityOrder: AchievementRarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common'];

    if (!telegramId) {
        return (
            <div className="container achievements-page">
                <div className="connect-prompt glass-panel">
                    <h2>{t('common.connectWallet')}</h2>
                    <p className="text-hint">
                        {t('achievements.subtitle')}
                    </p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="container achievements-page">
                <div className="loading">
                    <div className="loading-spinner" />
                </div>
            </div>
        );
    }

    return (
        <div className="container achievements-page">
            <header className="page-header">
                <h1 className="page-title">{t('achievements.title')}</h1>
                {stats && (
                    <div className="achievement-summary">
                        <div className="summary-stat">
                            <span className="stat-value text-mono">{stats.unlockedCount}</span>
                            <span className="stat-separator">/</span>
                            <span className="stat-total text-mono">{stats.totalAchievements}</span>
                        </div>
                        <div className="summary-progress">
                            <div
                                className="progress-fill"
                                style={{ width: `${stats.completionPct}%` }}
                            />
                        </div>
                        <span className="summary-pct text-mono">{stats.completionPct}%</span>
                    </div>
                )}
            </header>

            {stats && (
                <section className="stats-section glass-panel">
                    <div className="stats-grid">
                        <div className="stat-item">
                            <span className="stat-icon">🏅</span>
                            <span className="stat-value text-mono">{stats.pointsEarned}</span>
                            <span className="stat-label">{t('achievements.stats.pointsEarned')}</span>
                        </div>
                        {Object.entries(stats.rarityBreakdown || {}).map(([rarity, count]) => (
                            <div key={rarity} className="stat-item">
                                <span className="stat-value text-mono">{count as number}</span>
                                <span className="stat-label">{t(`achievements.rarity.${rarity}`)}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section className="filters-section">
                <div className="filter-group">
                    <label className="filter-label">{t('achievements.category')}</label>
                    <div className="filter-buttons">
                        {(['all', 'betting', 'streaks', 'social', 'special'] as FilterCategory[]).map((cat) => (
                            <button
                                key={cat}
                                className={`filter-btn ${categoryFilter === cat ? 'active' : ''}`}
                                onClick={() => setCategoryFilter(cat)}
                            >
                                {t(`achievements.categories.${cat}`)}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="filter-group">
                    <label className="filter-label">{t('markets.filterByStatus')}</label>
                    <div className="filter-buttons">
                        {(['all', 'unlocked', 'locked'] as FilterStatus[]).map((status) => (
                            <button
                                key={status}
                                className={`filter-btn ${statusFilter === status ? 'active' : ''}`}
                                onClick={() => setStatusFilter(status)}
                            >
                                {status === 'all' ? t('common.all') : t(`achievements.${status}`)}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="achievements-list">
                {rarityOrder.map((rarity) => {
                    const achievements = groupedByRarity?.[rarity];
                    if (!achievements?.length) return null;

                    return (
                        <div key={rarity} className="rarity-group">
                            <h3 className="rarity-header">
                                <span className="rarity-label">{t(`achievements.rarity.${rarity}`)}</span>
                                <span className="rarity-count text-mono">{achievements.length}</span>
                            </h3>
                            <AchievementGrid
                                achievements={achievements}
                                showProgress
                                onAchievementClick={setSelectedAchievement}
                            />
                        </div>
                    );
                })}

                {!filteredAchievements?.length && (
                    <div className="empty-state">
                        <p className="text-hint">{t('achievements.noMatches')}</p>
                    </div>
                )}
            </section>

            {selectedAchievement && (
                <div className="achievement-modal-overlay" onClick={() => setSelectedAchievement(null)}>
                    <div className="achievement-modal glass-panel" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setSelectedAchievement(null)}>
                            ×
                        </button>
                        <AchievementBadge achievement={selectedAchievement} size="lg" showProgress />
                        <div className="modal-details">
                            <p className="detail-description">{selectedAchievement.description}</p>
                            <div className="detail-reward">
                                <span className="reward-label">{t('achievements.reward')}:</span>
                                <span className="reward-value text-mono">+{selectedAchievement.pointsReward} {t('common.points')}</span>
                            </div>
                            {!selectedAchievement.isUnlocked && (
                                <div className="detail-progress">
                                    <span className="progress-label">{t('achievements.progress')}:</span>
                                    <span className="progress-value text-mono">
                                        {selectedAchievement.progress}/{selectedAchievement.target}
                                    </span>
                                </div>
                            )}
                            {selectedAchievement.isUnlocked && selectedAchievement.unlockedAt && (
                                <div className="detail-unlocked">
                                    {t('achievements.unlockedOn')} {new Date(selectedAchievement.unlockedAt).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AchievementsPage;
