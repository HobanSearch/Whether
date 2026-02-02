import { useState, useMemo } from 'react';
import { useTonAddress } from '@tonconnect/ui-react';
import { Link } from 'react-router-dom';
import { usePositions } from '../hooks/useMarkets';
import { useInsurancePolicies } from '../hooks/useInsurance';
import { useTelegramApp } from '../hooks/useTelegramApp';
import PositionCard from '../components/PositionCard';
import { LOCATIONS } from '../types';
import { formatTon, formatTemperature } from '../utils/format';
import './PortfolioPage.css';

type PositionFilter = 'all' | 'active' | 'settled' | 'claimable';

function PortfolioPage() {
    const address = useTonAddress();
    const { hapticFeedback } = useTelegramApp();
    const { data: positions, isLoading: positionsLoading } = usePositions(address);
    const { data: policies, isLoading: policiesLoading } = useInsurancePolicies(address);
    const [filter, setFilter] = useState<PositionFilter>('all');

    const filteredPositions = useMemo(() => {
        if (!positions) return [];

        switch (filter) {
            case 'active':
                return positions.filter(p => p.market.status === 'active');
            case 'settled':
                return positions.filter(p => p.market.status === 'settled');
            case 'claimable':
                return positions.filter(p => {
                    const isSettled = p.market.status === 'settled';
                    const hasYes = p.yesBalance > 0n;
                    const hasNo = p.noBalance > 0n;
                    const yesWon = p.market.outcome === 'YES' && hasYes;
                    const noWon = p.market.outcome === 'NO' && hasNo;
                    return isSettled && (yesWon || noWon) && p.status !== 'claimed';
                });
            default:
                return positions;
        }
    }, [positions, filter]);

    const claimableCount = useMemo(() => {
        if (!positions) return 0;
        return positions.filter(p => {
            const isSettled = p.market.status === 'settled';
            const hasYes = p.yesBalance > 0n;
            const hasNo = p.noBalance > 0n;
            const yesWon = p.market.outcome === 'YES' && hasYes;
            const noWon = p.market.outcome === 'NO' && hasNo;
            return isSettled && (yesWon || noWon) && p.status !== 'claimed';
        }).length;
    }, [positions]);

    if (!address) {
        return (
            <div className="container">
                <header className="page-header">
                    <h2 className="page-title">Portfolio</h2>
                </header>
                <div className="connect-prompt card">
                    <p>Connect your wallet to view your portfolio</p>
                </div>
            </div>
        );
    }

    const totalPositionValue = positions?.reduce((sum, pos) => {
        const yesValue = Number(pos.yesBalance) * pos.market.yesPrice;
        const noValue = Number(pos.noBalance) * pos.market.noPrice;
        return sum + yesValue + noValue;
    }, 0) ?? 0;

    const activePolicies = policies?.filter((p) => p.status === 'active') ?? [];
    const claimablePolicies = policies?.filter((p) => p.status === 'triggered') ?? [];

    return (
        <div className="container">
            <header className="page-header">
                <h2 className="page-title">Portfolio</h2>
                <p className="wallet-address">{address.slice(0, 8)}...{address.slice(-6)}</p>
            </header>

            <section className="summary-section card">
                <div className="summary-grid">
                    <div className="summary-item">
                        <span className="summary-value">
                            {formatTon(BigInt(Math.floor(totalPositionValue)))}
                        </span>
                        <span className="summary-label">Position Value</span>
                    </div>
                    <div className="summary-item">
                        <span className="summary-value">{positions?.length ?? 0}</span>
                        <span className="summary-label">Positions</span>
                    </div>
                    <div className="summary-item">
                        <span className="summary-value">{activePolicies.length}</span>
                        <span className="summary-label">Active Policies</span>
                    </div>
                </div>
            </section>

            {claimablePolicies.length > 0 && (
                <section className="alert-section">
                    <div className="alert-card">
                        <span className="alert-icon">🎉</span>
                        <div className="alert-content">
                            <span className="alert-title">
                                {claimablePolicies.length} policy ready to claim!
                            </span>
                            <Link to="/insurance" className="alert-link">
                                Claim now
                            </Link>
                        </div>
                    </div>
                </section>
            )}

            <section className="positions-section">
                <div className="section-header">
                    <h3 className="section-title">Market Positions</h3>
                    {claimableCount > 0 && (
                        <span className="claimable-badge">{claimableCount} to claim</span>
                    )}
                </div>

                <div className="position-filters">
                    {(['all', 'active', 'settled', 'claimable'] as PositionFilter[]).map((f) => (
                        <button
                            key={f}
                            className={`filter-btn ${filter === f ? 'active' : ''}`}
                            onClick={() => {
                                setFilter(f);
                                hapticFeedback('selection');
                            }}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                            {f === 'claimable' && claimableCount > 0 && (
                                <span className="filter-count">{claimableCount}</span>
                            )}
                        </button>
                    ))}
                </div>

                {positionsLoading ? (
                    <div className="loading">
                        <div className="loading-spinner" />
                    </div>
                ) : filteredPositions.length > 0 ? (
                    <div className="positions-list">
                        {filteredPositions.map((position) => (
                            <PositionCard
                                key={position.marketId}
                                position={position}
                                locationName={LOCATIONS[position.market.location]?.name}
                            />
                        ))}
                    </div>
                ) : positions && positions.length > 0 ? (
                    <div className="empty-state card">
                        <p>No {filter} positions</p>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setFilter('all')}
                        >
                            Show All
                        </button>
                    </div>
                ) : (
                    <div className="empty-state card">
                        <p>No positions yet</p>
                        <Link to="/markets" className="btn btn-primary">
                            Browse Markets
                        </Link>
                    </div>
                )}
            </section>

            <section className="policies-section">
                <h3 className="section-title">Insurance Policies</h3>

                {policiesLoading ? (
                    <div className="loading">
                        <div className="loading-spinner" />
                    </div>
                ) : policies && policies.length > 0 ? (
                    <div className="policies-list">
                        {policies.slice(0, 5).map((policy) => (
                            <div key={policy.id} className="policy-summary card">
                                <div className="policy-header">
                                    <span className="policy-location">
                                        {LOCATIONS[policy.location]?.name || policy.location}
                                    </span>
                                    <span className={`policy-status ${policy.status}`}>
                                        {policy.status.toUpperCase()}
                                    </span>
                                </div>
                                <div className="policy-info">
                                    <span>
                                        {policy.triggerComparison === 'above' ? '>' : '<'}{' '}
                                        {formatTemperature(policy.triggerThreshold)}
                                    </span>
                                    <span>{formatTon(policy.coverageAmount)} TON</span>
                                </div>
                            </div>
                        ))}
                        {policies.length > 5 && (
                            <Link to="/insurance" className="view-all-link">
                                View all {policies.length} policies
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="empty-state card">
                        <p>No policies yet</p>
                        <Link to="/insurance" className="btn btn-primary">
                            Get Coverage
                        </Link>
                    </div>
                )}
            </section>
        </div>
    );
}

export default PortfolioPage;
