import type { Achievement, AchievementRarity } from '../types';
import { RARITY_COLORS, RARITY_LABELS } from '../types';
import './AchievementBadge.css';

interface AchievementBadgeProps {
    achievement: Achievement;
    size?: 'sm' | 'md' | 'lg';
    showProgress?: boolean;
    onClick?: () => void;
}

function AchievementBadge({
    achievement,
    size = 'md',
    showProgress = false,
    onClick,
}: AchievementBadgeProps) {
    const rarityColor = achievement.badgeColor || RARITY_COLORS[achievement.rarity as AchievementRarity] || RARITY_COLORS.common;
    const rarityLabel = RARITY_LABELS[achievement.rarity as AchievementRarity] || 'Common';

    return (
        <div
            className={`achievement-badge ${size} ${achievement.isUnlocked ? 'unlocked' : 'locked'}`}
            onClick={onClick}
            style={{
                '--badge-color': rarityColor,
            } as React.CSSProperties}
        >
            <div className="badge-icon-wrapper">
                <span className="badge-icon">{achievement.icon}</span>
                {!achievement.isUnlocked && (
                    <div className="lock-overlay">
                        <span className="lock-icon">🔒</span>
                    </div>
                )}
            </div>

            <div className="badge-info">
                <span className="badge-name">{achievement.name}</span>
                <span className="badge-rarity" style={{ color: rarityColor }}>
                    {rarityLabel}
                </span>
                {size !== 'sm' && (
                    <span className="badge-description">{achievement.description}</span>
                )}
            </div>

            {showProgress && !achievement.isUnlocked && (
                <div className="badge-progress">
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${achievement.progressPct}%` }}
                        />
                    </div>
                    <span className="progress-text text-mono">
                        {achievement.progress}/{achievement.target}
                    </span>
                </div>
            )}

            {achievement.isUnlocked && (
                <div className="badge-reward">
                    <span className="reward-points text-mono">+{achievement.pointsReward}</span>
                    <span className="reward-label">pts</span>
                </div>
            )}
        </div>
    );
}

interface AchievementGridProps {
    achievements: Achievement[];
    showProgress?: boolean;
    onAchievementClick?: (achievement: Achievement) => void;
}

export function AchievementGrid({
    achievements,
    showProgress = true,
    onAchievementClick,
}: AchievementGridProps) {
    return (
        <div className="achievement-grid">
            {achievements.map((achievement) => (
                <AchievementBadge
                    key={achievement.id}
                    achievement={achievement}
                    showProgress={showProgress}
                    onClick={() => onAchievementClick?.(achievement)}
                />
            ))}
        </div>
    );
}

interface AchievementToastProps {
    achievement: Achievement;
    onClose?: () => void;
}

export function AchievementToast({ achievement, onClose }: AchievementToastProps) {
    const rarityColor = achievement.badgeColor || RARITY_COLORS[achievement.rarity as AchievementRarity];

    return (
        <div className="achievement-toast" style={{ '--badge-color': rarityColor } as React.CSSProperties}>
            <div className="toast-header">
                <span className="toast-label">Achievement Unlocked!</span>
                {onClose && (
                    <button className="toast-close" onClick={onClose}>×</button>
                )}
            </div>
            <div className="toast-content">
                <span className="toast-icon">{achievement.icon}</span>
                <div className="toast-info">
                    <span className="toast-name">{achievement.name}</span>
                    <span className="toast-reward">+{achievement.pointsReward} points</span>
                </div>
            </div>
        </div>
    );
}

export default AchievementBadge;
