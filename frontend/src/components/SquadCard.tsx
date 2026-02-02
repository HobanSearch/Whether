import { Link } from 'react-router-dom';
import type { Squad } from '../types';
import { formatTon } from '../utils/format';
import './SquadCard.css';

interface SquadCardProps {
    squad: Squad;
    showRank?: boolean;
    rank?: number;
    isUserSquad?: boolean;
}

function SquadCard({ squad, showRank = false, rank, isUserSquad = false }: SquadCardProps) {
    return (
        <Link to={`/squads/${squad.id}`} className={`squad-card glass-panel ${isUserSquad ? 'user-squad' : ''}`}>
            {showRank && rank !== undefined && (
                <div className={`squad-rank ${rank <= 3 ? `rank-${rank}` : ''}`}>
                    <span className="rank-number text-mono">{rank}</span>
                </div>
            )}

            <div className="squad-info">
                <div className="squad-header">
                    <span className="squad-name">{squad.name}</span>
                    <span className="squad-code text-mono text-hint">{squad.code}</span>
                </div>
                {squad.region && (
                    <span className="squad-region text-hint text-xs">{squad.region}</span>
                )}
            </div>

            <div className="squad-stats">
                <div className="stat-item">
                    <span className="stat-value text-mono">{squad.memberCount}</span>
                    <span className="stat-label text-hint">Members</span>
                </div>
                <div className="stat-item">
                    <span className="stat-value text-mono">{formatTon(squad.totalVolume)}</span>
                    <span className="stat-label text-hint">Volume</span>
                </div>
                <div className="stat-item">
                    <span className="stat-value text-mono">{(squad.totalAccuracy * 100).toFixed(0)}%</span>
                    <span className="stat-label text-hint">Accuracy</span>
                </div>
            </div>

            {isUserSquad && (
                <div className="user-squad-badge">Your Squad</div>
            )}
        </Link>
    );
}

export default SquadCard;
