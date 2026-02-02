import type { User } from '../types';
import { USER_TIER_NAMES } from '../types';
import { formatTon, formatAddress } from '../utils/format';
import './UserProfile.css';

interface UserProfileProps {
    user: User;
    showReferral?: boolean;
    compact?: boolean;
}

function UserProfile({ user, showReferral = true, compact = false }: UserProfileProps) {
    const tierName = USER_TIER_NAMES[user.tier];
    const tierColors: Record<number, string> = {
        1: '#888888',
        2: '#4DB8FF',
        3: '#FFD700',
        4: '#FF5C00',
    };
    const tierColor = tierColors[user.tier] || '#888888';

    if (compact) {
        return (
            <div className="user-profile-compact glass-panel">
                <div className="user-avatar">
                    {user.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="user-info-compact">
                    <span className="user-name">{user.username || 'Anonymous'}</span>
                    <span
                        className="tier-badge-sm"
                        style={{ backgroundColor: `${tierColor}20`, color: tierColor }}
                    >
                        {tierName}
                    </span>
                </div>
            </div>
        );
    }

    const { stats } = user;

    return (
        <div className="user-profile glass-panel">
            <div className="profile-header">
                <div className="profile-avatar-container">
                    <div className="profile-avatar" style={{ borderColor: tierColor }}>
                        {user.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div
                        className="tier-badge"
                        style={{ backgroundColor: tierColor }}
                    >
                        Tier {user.tier}
                    </div>
                </div>

                <div className="profile-info">
                    <h2 className="profile-name">
                        {user.firstName || user.username || 'Anonymous'}
                        {user.lastName && ` ${user.lastName}`}
                    </h2>
                    {user.username && (
                        <span className="profile-username text-hint">@{user.username}</span>
                    )}
                    <span
                        className="tier-name"
                        style={{ color: tierColor }}
                    >
                        {tierName}
                    </span>
                </div>
            </div>

            {user.tonAddress && (
                <div className="wallet-section">
                    <span className="wallet-label text-hint text-xs">TON Wallet</span>
                    <span className="wallet-address text-mono">
                        {formatAddress(user.tonAddress, 6)}
                    </span>
                </div>
            )}

            <div className="stats-grid">
                <div className="stat-box">
                    <span className="stat-value text-mono">{stats.totalBets}</span>
                    <span className="stat-label text-hint">Bets</span>
                </div>
                <div className="stat-box">
                    <span className="stat-value text-mono">{stats.totalWins}</span>
                    <span className="stat-label text-hint">Wins</span>
                </div>
                <div className="stat-box">
                    <span className="stat-value text-mono success">
                        {(stats.winRate * 100).toFixed(0)}%
                    </span>
                    <span className="stat-label text-hint">Win Rate</span>
                </div>
                <div className="stat-box">
                    <span className="stat-value text-mono">
                        {formatTon(stats.totalVolume)}
                    </span>
                    <span className="stat-label text-hint">Volume</span>
                </div>
            </div>

            {stats.accuracyScore !== undefined && (
                <div className="accuracy-section">
                    <div className="accuracy-header">
                        <span className="accuracy-label text-hint">Prediction Accuracy</span>
                        <span className="accuracy-value text-mono text-glow">
                            {(stats.accuracyScore * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div className="accuracy-bar">
                        <div
                            className="accuracy-fill"
                            style={{ width: `${stats.accuracyScore * 100}%` }}
                        ></div>
                    </div>
                </div>
            )}

            {showReferral && user.referralCode && (
                <div className="referral-section">
                    <span className="referral-label text-hint text-xs">Your Referral Code</span>
                    <div className="referral-code-container">
                        <span className="referral-code text-mono">{user.referralCode}</span>
                        <button
                            className="copy-btn"
                            onClick={() => navigator.clipboard.writeText(user.referralCode!)}
                        >
                            Copy
                        </button>
                    </div>
                </div>
            )}

            {user.squad && (
                <div className="squad-section">
                    <span className="squad-label text-hint text-xs">Squad</span>
                    <div className="squad-info-row">
                        <span className="squad-name">{user.squad.name}</span>
                        <span className="squad-code text-mono text-hint">
                            {user.squad.code}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserProfile;
