import { useState } from 'react';
import { useSquads, useSquadLeaderboard, useSquadRegions, useSearchSquads } from '../hooks';
import { useTelegramApp } from '../hooks/useTelegramApp';
import SquadCard from '../components/SquadCard';
import './SquadsPage.css';

type TabType = 'leaderboard' | 'browse' | 'search';

function SquadsPage() {
    useTelegramApp();
    const [activeTab, setActiveTab] = useState<TabType>('leaderboard');
    const [period, setPeriod] = useState<'weekly' | 'all_time'>('weekly');
    const [selectedRegion, setSelectedRegion] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    const { data: leaderboardData, isLoading: leaderboardLoading } = useSquadLeaderboard(period);
    const { data: squadsList, isLoading: squadsLoading } = useSquads({
        region: selectedRegion || undefined,
    });
    const { data: regions } = useSquadRegions();
    const { data: searchResults, isLoading: searchLoading } = useSearchSquads(searchQuery);

    const userSquadId = undefined; // Would come from user context

    const renderLeaderboard = () => {
        if (leaderboardLoading) {
            return (
                <div className="loading">
                    <div className="loading-spinner" />
                </div>
            );
        }

        const entries = leaderboardData?.entries || [];

        return (
            <div className="leaderboard">
                <div className="period-toggle">
                    <button
                        className={`toggle-btn ${period === 'weekly' ? 'active' : ''}`}
                        onClick={() => setPeriod('weekly')}
                    >
                        This Week
                    </button>
                    <button
                        className={`toggle-btn ${period === 'all_time' ? 'active' : ''}`}
                        onClick={() => setPeriod('all_time')}
                    >
                        All Time
                    </button>
                </div>

                {entries.length > 0 ? (
                    <div className="squads-list">
                        {entries.map((entry: any) => (
                            <SquadCard
                                key={entry.squad_id}
                                squad={{
                                    id: entry.squad_id,
                                    name: entry.name,
                                    code: entry.code,
                                    region: entry.region,
                                    memberCount: entry.member_count,
                                    totalVolume: BigInt(entry.total_volume),
                                    totalWins: entry.total_wins,
                                    totalAccuracy: entry.total_accuracy,
                                    weeklyRank: entry.rank,
                                    allTimeRank: entry.rank,
                                }}
                                showRank
                                rank={entry.rank}
                                isUserSquad={entry.squad_id === userSquadId}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="empty-state glass-panel">
                        <p className="text-hint">No squads yet</p>
                    </div>
                )}
            </div>
        );
    };

    const renderBrowse = () => {
        if (squadsLoading) {
            return (
                <div className="loading">
                    <div className="loading-spinner" />
                </div>
            );
        }

        return (
            <div className="browse-section">
                <div className="region-filter">
                    <select
                        className="region-select"
                        value={selectedRegion}
                        onChange={(e) => setSelectedRegion(e.target.value)}
                    >
                        <option value="">All Regions</option>
                        {regions?.map((region) => (
                            <option key={region} value={region}>
                                {region}
                            </option>
                        ))}
                    </select>
                </div>

                {squadsList && squadsList.length > 0 ? (
                    <div className="squads-list">
                        {squadsList.map((squad) => (
                            <SquadCard
                                key={squad.id}
                                squad={squad}
                                isUserSquad={squad.id === userSquadId}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="empty-state glass-panel">
                        <p className="text-hint">No squads found</p>
                    </div>
                )}
            </div>
        );
    };

    const renderSearch = () => {
        return (
            <div className="search-section">
                <div className="search-input-container">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search by name or code..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {searchLoading ? (
                    <div className="loading">
                        <div className="loading-spinner" />
                    </div>
                ) : searchQuery.length > 0 ? (
                    searchResults && searchResults.length > 0 ? (
                        <div className="squads-list">
                            {searchResults.map((squad) => (
                                <SquadCard
                                    key={squad.id}
                                    squad={squad}
                                    isUserSquad={squad.id === userSquadId}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state glass-panel">
                            <p className="text-hint">No squads match "{searchQuery}"</p>
                        </div>
                    )
                ) : (
                    <div className="search-prompt glass-panel">
                        <p className="text-hint">Enter a squad name or code to search</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="container squads-page">
            <header className="page-header">
                <h1 className="page-title">Squads</h1>
                <p className="page-subtitle text-hint">
                    Join a regional team and compete for glory
                </p>
            </header>

            <nav className="tabs-nav">
                <button
                    className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
                    onClick={() => setActiveTab('leaderboard')}
                >
                    Leaderboard
                </button>
                <button
                    className={`tab-btn ${activeTab === 'browse' ? 'active' : ''}`}
                    onClick={() => setActiveTab('browse')}
                >
                    Browse
                </button>
                <button
                    className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`}
                    onClick={() => setActiveTab('search')}
                >
                    Search
                </button>
            </nav>

            <div className="tab-content">
                {activeTab === 'leaderboard' && renderLeaderboard()}
                {activeTab === 'browse' && renderBrowse()}
                {activeTab === 'search' && renderSearch()}
            </div>
        </div>
    );
}

export default SquadsPage;
