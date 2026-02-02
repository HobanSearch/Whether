import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Position } from '../types';
import { formatTon } from '../utils/format';
import './TradingTrackRecord.css';

interface TradingTrackRecordProps {
    positions: Position[];
}

interface TrackRecordStats {
    totalTrades: number;
    wins: number;
    losses: number;
    pending: number;
    winRate: number;
    totalVolume: bigint;
    totalPnl: number;
    bestWin: number;
    worstLoss: number;
}

function TradingTrackRecord({ positions }: TradingTrackRecordProps) {
    const { t } = useTranslation();

    const stats = useMemo((): TrackRecordStats => {
        let wins = 0;
        let losses = 0;
        let pending = 0;
        let totalVolume = 0n;
        let totalPnl = 0;
        let bestWin = 0;
        let worstLoss = 0;

        for (const position of positions) {
            const yesValue = Number(position.yesBalance);
            const noValue = Number(position.noBalance);
            totalVolume += position.yesBalance + position.noBalance;

            if (position.market.status === 'settled') {
                const outcome = position.market.outcome;
                const hasYes = yesValue > 0;
                const hasNo = noValue > 0;
                const yesWon = outcome === 'YES' && hasYes;
                const noWon = outcome === 'NO' && hasNo;

                if (yesWon || noWon) {
                    wins++;
                    const pnl = position.unrealizedPnl ?? 0;
                    totalPnl += pnl;
                    if (pnl > bestWin) bestWin = pnl;
                } else if (hasYes || hasNo) {
                    losses++;
                    const pnl = position.unrealizedPnl ?? 0;
                    totalPnl += pnl;
                    if (pnl < worstLoss) worstLoss = pnl;
                }
            } else {
                pending++;
            }
        }

        const totalTrades = wins + losses + pending;
        const completedTrades = wins + losses;
        const winRate = completedTrades > 0 ? (wins / completedTrades) * 100 : 0;

        return {
            totalTrades,
            wins,
            losses,
            pending,
            winRate,
            totalVolume,
            totalPnl,
            bestWin,
            worstLoss,
        };
    }, [positions]);

    const recentTrades = useMemo(() => {
        return positions
            .filter((p) => p.market.status === 'settled')
            .slice(0, 5)
            .map((p) => {
                const outcome = p.market.outcome;
                const hasYes = p.yesBalance > 0n;
                const hasNo = p.noBalance > 0n;
                const won = (outcome === 'YES' && hasYes) || (outcome === 'NO' && hasNo);
                return {
                    id: p.id,
                    question: p.market.question,
                    side: hasYes ? 'YES' : 'NO',
                    won,
                    pnl: p.unrealizedPnl ?? 0,
                };
            });
    }, [positions]);

    return (
        <div className="trading-track-record glass-panel">
            <div className="stats-grid">
                <div className="stat-item">
                    <span className="stat-value">{stats.totalTrades}</span>
                    <span className="stat-label">{t('profile.stats.totalTrades')}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-value win">{stats.wins}</span>
                    <span className="stat-label">{t('profile.stats.wins')}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-value loss">{stats.losses}</span>
                    <span className="stat-label">{t('profile.stats.losses')}</span>
                </div>
                <div className="stat-item">
                    <span className={`stat-value ${stats.winRate >= 50 ? 'win' : 'loss'}`}>
                        {stats.winRate.toFixed(1)}%
                    </span>
                    <span className="stat-label">{t('profile.stats.winRate')}</span>
                </div>
            </div>

            <div className="volume-row">
                <div className="volume-item">
                    <span className="volume-label">{t('profile.stats.totalVolume')}</span>
                    <span className="volume-value text-mono">{formatTon(stats.totalVolume)} TON</span>
                </div>
                <div className="volume-item">
                    <span className="volume-label">{t('profile.stats.pending')}</span>
                    <span className="volume-value text-mono">{stats.pending}</span>
                </div>
            </div>

            {recentTrades.length > 0 && (
                <div className="recent-trades">
                    <h4 className="recent-title">{t('profile.recentTrades')}</h4>
                    <div className="trades-list">
                        {recentTrades.map((trade) => (
                            <div key={trade.id} className={`trade-item ${trade.won ? 'won' : 'lost'}`}>
                                <div className="trade-info">
                                    <span className={`trade-result ${trade.won ? 'win' : 'loss'}`}>
                                        {trade.won ? '✓' : '✗'}
                                    </span>
                                    <span className="trade-question">{trade.question}</span>
                                </div>
                                <span className={`trade-side ${trade.side.toLowerCase()}`}>
                                    {trade.side}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default TradingTrackRecord;
