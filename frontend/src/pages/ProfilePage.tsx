import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTelegramApp } from '../hooks/useTelegramApp';
import { useCurrentUser, useCreateOrUpdateUser, useApplyReferral, useJoinSquad, useLeaveSquad, usePositions } from '../hooks';
import UserProfile from '../components/UserProfile';
import PointsDisplay, { DailyLoginReward } from '../components/PointsDisplay';
import StreakDisplay from '../components/StreakDisplay';
import { AchievementGrid } from '../components/AchievementBadge';
import LanguageSelector from '../components/LanguageSelector';
import TemperatureToggle from '../components/TemperatureToggle';
import TradingTrackRecord from '../components/TradingTrackRecord';
import { api } from '../services/api';
import { formatAddress } from '../utils/format';
import './ProfilePage.css';

interface DailyRewardState {
    baseAmount: number;
    streakBonus: number;
    totalAwarded: number;
    loginStreak: number;
}

function ProfilePage() {
    const { t } = useTranslation();
    const tonAddress = useTonAddress();
    const [tonConnectUI] = useTonConnectUI();
    const { user: telegramUser } = useTelegramApp();
    const queryClient = useQueryClient();
    const [referralInput, setReferralInput] = useState('');
    const [squadCodeInput, setSquadCodeInput] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [dailyReward, setDailyReward] = useState<DailyRewardState | null>(null);

    const telegramId = telegramUser?.id;
    const { data: user, isLoading, refetch } = useCurrentUser(telegramId);
    const createOrUpdateUser = useCreateOrUpdateUser();
    const { data: positions } = usePositions(tonAddress);

    const applyReferralMutation = useApplyReferral();
    const joinSquadMutation = useJoinSquad();
    const leaveSquadMutation = useLeaveSquad();

    useEffect(() => {
        if (telegramId && tonAddress && !user && !isLoading) {
            createOrUpdateUser.mutate({
                telegramId,
                tonAddress,
                username: telegramUser?.username,
            });
        }
    }, [telegramId, tonAddress, user, isLoading, telegramUser?.username]);

    const { data: pointsInfo } = useQuery({
        queryKey: ['points', user?.id],
        queryFn: () => api.getPointsInfo(user!.id),
        enabled: !!user?.id,
    });

    const { data: streakInfo } = useQuery({
        queryKey: ['streak', user?.id],
        queryFn: () => api.getStreakInfo(user!.id),
        enabled: !!user?.id,
    });

    const { data: recentAchievements } = useQuery({
        queryKey: ['achievements', 'recent', user?.id],
        queryFn: () => api.getRecentAchievements(user!.id, 4),
        enabled: !!user?.id,
    });

    const claimDailyMutation = useMutation({
        mutationFn: () => api.claimDailyLogin(user!.id),
        onSuccess: (result) => {
            if (result.success && result.totalAwarded) {
                setDailyReward({
                    baseAmount: result.baseAmount ?? 0,
                    streakBonus: result.streakBonus ?? 0,
                    totalAwarded: result.totalAwarded,
                    loginStreak: result.loginStreak ?? 1,
                });
            }
            queryClient.invalidateQueries({ queryKey: ['points', user?.id] });
        },
        onError: (error: any) => {
            setMessage({ type: 'error', text: error.message || 'Failed to claim daily bonus' });
        },
    });

    const handleApplyReferral = async () => {
        if (!user || !referralInput.trim()) return;

        try {
            const result = await applyReferralMutation.mutateAsync({
                userId: user.id,
                referralCode: referralInput.trim(),
            });
            setMessage({ type: 'success', text: result.message });
            setReferralInput('');
            refetch();
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to apply referral' });
        }
    };

    const handleJoinSquad = async () => {
        if (!user || !squadCodeInput.trim()) return;

        try {
            const result = await joinSquadMutation.mutateAsync({
                userId: user.id,
                squadId: squadCodeInput.trim(),
            });
            setMessage({ type: 'success', text: result.message });
            setSquadCodeInput('');
            refetch();
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to join squad' });
        }
    };

    const handleLeaveSquad = async () => {
        if (!user) return;

        try {
            const result = await leaveSquadMutation.mutateAsync(user.id);
            setMessage({ type: 'success', text: result.message });
            refetch();
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to leave squad' });
        }
    };

    if (!telegramId && !tonAddress) {
        return (
            <div className="container profile-page">
                <div className="connect-prompt glass-panel">
                    <h2>{t('common.connectWallet')}</h2>
                    <p className="text-hint">
                        {t('profile.wallet.notConnected')}
                    </p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="container profile-page">
                <div className="loading">
                    <div className="loading-spinner" />
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="container profile-page">
                <header className="page-header">
                    <h1 className="page-title">{t('profile.title')}</h1>
                </header>

                {tonAddress && (
                    <section className="wallet-section">
                        <div className="glass-panel wallet-info">
                            <div className="wallet-header">
                                <span className="wallet-label">{t('profile.wallet.connected')}</span>
                                <span className="wallet-address text-mono">{formatAddress(tonAddress, 6)}</span>
                            </div>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => tonConnectUI.disconnect()}
                            >
                                {t('common.disconnect')}
                            </button>
                        </div>
                    </section>
                )}

                {tonAddress && positions && positions.length > 0 && (
                    <section className="track-record-section">
                        <h3 className="section-title">{t('profile.tradingRecord')}</h3>
                        <TradingTrackRecord positions={positions} />
                    </section>
                )}

                <section className="settings-section">
                    <h3 className="section-title">{t('common.settings')}</h3>
                    <div className="glass-panel settings-panel">
                        <div className="setting-row">
                            <span className="setting-label">{t('settings.language')}</span>
                            <LanguageSelector variant="buttons" />
                        </div>
                        <div className="setting-row">
                            <span className="setting-label">{t('settings.temperatureUnit')}</span>
                            <TemperatureToggle />
                        </div>
                    </div>
                </section>

                {!telegramId && (
                    <section className="telegram-prompt-section">
                        <div className="glass-panel telegram-prompt">
                            <h4>{t('profile.telegram.linkAccount')}</h4>
                            <p className="text-hint">
                                {t('profile.telegram.linkDescription')}
                            </p>
                        </div>
                    </section>
                )}

                <section className="links-section">
                    <Link to="/portfolio" className="link-card glass-panel">
                        <span className="link-icon">💼</span>
                        <span className="link-text">{t('profile.links.viewPositions')}</span>
                        <span className="link-arrow">→</span>
                    </Link>
                    <Link to="/markets" className="link-card glass-panel">
                        <img src="/assets/weather/chart.png" alt="Markets" className="link-icon-img" />
                        <span className="link-text">{t('profile.links.browseMarkets')}</span>
                        <span className="link-arrow">→</span>
                    </Link>
                </section>
            </div>
        );
    }

    return (
        <div className="container profile-page">
            <header className="page-header">
                <h1 className="page-title">{t('profile.title')}</h1>
            </header>

            {message && (
                <div className={`message-banner ${message.type}`}>
                    {message.text}
                    <button className="dismiss-btn" onClick={() => setMessage(null)}>
                        ×
                    </button>
                </div>
            )}

            <section className="profile-section">
                <UserProfile user={user} />
            </section>

            {pointsInfo && (
                <section className="engagement-section">
                    <PointsDisplay
                        points={pointsInfo}
                        showBreakdown={false}
                        onClaimDaily={() => claimDailyMutation.mutate()}
                        isDailyClaimLoading={claimDailyMutation.isPending}
                    />
                </section>
            )}

            {streakInfo && (
                <section className="engagement-section">
                    <StreakDisplay streak={streakInfo} size="md" showMilestone />
                </section>
            )}

            {recentAchievements && recentAchievements.length > 0 && (
                <section className="achievements-section">
                    <div className="section-header">
                        <h3 className="section-title">{t('achievements.recentAchievements')}</h3>
                        <Link to="/achievements" className="view-all-link">
                            {t('common.viewAll')} →
                        </Link>
                    </div>
                    <AchievementGrid achievements={recentAchievements} />
                </section>
            )}

            {tonAddress && positions && positions.length > 0 && (
                <section className="track-record-section">
                    <div className="section-header">
                        <h3 className="section-title">{t('profile.tradingRecord')}</h3>
                        <Link to="/portfolio" className="view-all-link">
                            {t('common.viewAll')} →
                        </Link>
                    </div>
                    <TradingTrackRecord positions={positions} />
                </section>
            )}

            {!user.squad && (
                <section className="squad-join-section">
                    <h3 className="section-title">{t('squads.joinSquad')}</h3>
                    <div className="glass-panel input-section">
                        <p className="section-desc text-hint">
                            {t('squads.joinDescription')}
                        </p>
                        <div className="input-row">
                            <input
                                type="text"
                                className="text-input"
                                placeholder={t('squads.enterCode')}
                                value={squadCodeInput}
                                onChange={(e) => setSquadCodeInput(e.target.value)}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={handleJoinSquad}
                                disabled={!squadCodeInput.trim() || joinSquadMutation.isPending}
                            >
                                {joinSquadMutation.isPending ? t('common.loading') : t('squads.join')}
                            </button>
                        </div>
                        <Link to="/squads" className="browse-link text-sm">
                            {t('squads.browseAll')} →
                        </Link>
                    </div>
                </section>
            )}

            {user.squad && (
                <section className="squad-section">
                    <h3 className="section-title">{t('squads.yourSquad')}</h3>
                    <div className="glass-panel">
                        <Link to={`/squads/${user.squadId}`} className="squad-link">
                            <div className="squad-row">
                                <div className="squad-info">
                                    <span className="squad-name">{user.squad.name}</span>
                                    <span className="squad-code text-mono text-hint">
                                        {user.squad.code}
                                    </span>
                                </div>
                                <span className="squad-rank text-mono">
                                    #{user.squad.weeklyRank || '—'}
                                </span>
                            </div>
                        </Link>
                        <button
                            className="btn btn-secondary btn-full leave-btn"
                            onClick={handleLeaveSquad}
                            disabled={leaveSquadMutation.isPending}
                        >
                            {leaveSquadMutation.isPending ? t('common.loading') : t('squads.leaveSquad')}
                        </button>
                    </div>
                </section>
            )}

            <section className="referral-apply-section">
                <h3 className="section-title">{t('profile.referral.applyCode')}</h3>
                <div className="glass-panel input-section">
                    <p className="section-desc text-hint">
                        {t('profile.referral.applyDescription')}
                    </p>
                    <div className="input-row">
                        <input
                            type="text"
                            className="text-input"
                            placeholder={t('profile.referral.enterCode')}
                            value={referralInput}
                            onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={handleApplyReferral}
                            disabled={!referralInput.trim() || applyReferralMutation.isPending}
                        >
                            {applyReferralMutation.isPending ? t('common.loading') : t('profile.referral.apply')}
                        </button>
                    </div>
                </div>
            </section>

            <section className="settings-section">
                <h3 className="section-title">{t('common.settings')}</h3>
                <div className="glass-panel settings-panel">
                    <div className="setting-row">
                        <span className="setting-label">{t('settings.language')}</span>
                        <LanguageSelector variant="buttons" />
                    </div>
                    <div className="setting-row">
                        <span className="setting-label">{t('settings.temperatureUnit')}</span>
                        <TemperatureToggle />
                    </div>
                </div>
            </section>

            <section className="links-section">
                <Link to="/portfolio" className="link-card glass-panel">
                    <span className="link-icon">💼</span>
                    <span className="link-text">{t('profile.links.viewPositions')}</span>
                    <span className="link-arrow">→</span>
                </Link>
                <Link to="/markets" className="link-card glass-panel">
                    <img src="/assets/weather/chart.png" alt="Markets" className="link-icon-img" />
                    <span className="link-text">{t('profile.links.browseMarkets')}</span>
                    <span className="link-arrow">→</span>
                </Link>
                <Link to="/achievements" className="link-card glass-panel">
                    <span className="link-icon">🏅</span>
                    <span className="link-text">{t('nav.achievements')}</span>
                    <span className="link-arrow">→</span>
                </Link>
                <Link to="/leaderboard" className="link-card glass-panel">
                    <span className="link-icon">🏆</span>
                    <span className="link-text">{t('nav.leaderboard')}</span>
                    <span className="link-arrow">→</span>
                </Link>
            </section>

            {dailyReward && (
                <div className="daily-reward-modal-overlay" onClick={() => setDailyReward(null)}>
                    <div onClick={(e) => e.stopPropagation()}>
                        <DailyLoginReward
                            baseAmount={dailyReward.baseAmount}
                            streakBonus={dailyReward.streakBonus}
                            totalAwarded={dailyReward.totalAwarded}
                            loginStreak={dailyReward.loginStreak}
                            onClose={() => setDailyReward(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProfilePage;
