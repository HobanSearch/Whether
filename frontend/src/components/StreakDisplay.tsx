import type { StreakInfo } from '../types';
import { STREAK_MULTIPLIERS } from '../types';
import './StreakDisplay.css';

interface StreakDisplayProps {
    streak: StreakInfo;
    size?: 'sm' | 'md' | 'lg';
    showMultiplier?: boolean;
    showMilestone?: boolean;
}

function StreakDisplay({
    streak,
    size = 'md',
    showMultiplier = true,
    showMilestone = true,
}: StreakDisplayProps) {
    const getStreakLevel = (count: number): string => {
        if (count >= 20) return 'legendary';
        if (count >= 10) return 'epic';
        if (count >= 5) return 'rare';
        if (count >= 3) return 'uncommon';
        return 'common';
    };

    const level = getStreakLevel(streak.currentStreak);
    const isActive = streak.isActive && streak.currentStreak > 0;

    return (
        <div className={`streak-display ${size} ${level} ${isActive ? 'active' : 'inactive'}`}>
            <div className="streak-flame">
                {isActive ? (
                    <span className="flame-icon">🔥</span>
                ) : (
                    <span className="flame-icon faded">💨</span>
                )}
            </div>

            <div className="streak-info">
                <div className="streak-count">
                    <span className="count-value text-mono">{streak.currentStreak}</span>
                    <span className="count-label">Win Streak</span>
                </div>

                {showMultiplier && streak.multiplier > 1 && (
                    <div className="streak-multiplier">
                        <span className="multiplier-value text-mono">{streak.multiplier.toFixed(2)}x</span>
                        <span className="multiplier-label">Bonus</span>
                    </div>
                )}
            </div>

            {showMilestone && streak.nextMilestone && isActive && (
                <div className="streak-milestone">
                    <span className="milestone-label">Next milestone:</span>
                    <span className="milestone-value text-mono">
                        {streak.nextMilestone} ({streak.nextMilestoneMultiplier?.toFixed(2)}x)
                    </span>
                </div>
            )}

            {size !== 'sm' && (
                <div className="streak-best">
                    <span className="best-label">Best:</span>
                    <span className="best-value text-mono">{streak.bestStreak}</span>
                </div>
            )}
        </div>
    );
}

interface StreakProgressProps {
    currentStreak: number;
    showLabels?: boolean;
}

export function StreakProgress({ currentStreak, showLabels = true }: StreakProgressProps) {
    const milestones = Object.keys(STREAK_MULTIPLIERS).map(Number).filter(m => m > 0).sort((a, b) => a - b);

    return (
        <div className="streak-progress-bar">
            <div className="progress-track">
                {milestones.map((milestone, index) => {
                    const prevMilestone = index > 0 ? milestones[index - 1] : 0;
                    const progress = Math.min(100, Math.max(0,
                        ((currentStreak - prevMilestone) / (milestone - prevMilestone)) * 100
                    ));
                    const isComplete = currentStreak >= milestone;

                    return (
                        <div
                            key={milestone}
                            className={`progress-segment ${isComplete ? 'complete' : ''}`}
                            style={{ '--progress': `${isComplete ? 100 : progress}%` } as React.CSSProperties}
                        >
                            <div className="segment-fill" />
                            <div className={`milestone-marker ${isComplete ? 'complete' : ''}`}>
                                <span className="marker-value">{milestone}</span>
                                {showLabels && (
                                    <span className="marker-bonus">{STREAK_MULTIPLIERS[milestone]}x</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface StreakBadgeProps {
    streak: number;
    size?: 'sm' | 'md';
}

export function StreakBadge({ streak, size = 'md' }: StreakBadgeProps) {
    if (streak === 0) return null;

    const getMultiplier = (s: number): number => {
        const thresholds = Object.keys(STREAK_MULTIPLIERS).map(Number).sort((a, b) => b - a);
        for (const t of thresholds) {
            if (s >= t) return STREAK_MULTIPLIERS[t];
        }
        return 1;
    };

    const multiplier = getMultiplier(streak);

    return (
        <div className={`streak-badge ${size}`}>
            <span className="badge-flame">🔥</span>
            <span className="badge-count text-mono">{streak}</span>
            {multiplier > 1 && (
                <span className="badge-multiplier text-mono">{multiplier}x</span>
            )}
        </div>
    );
}

export default StreakDisplay;
