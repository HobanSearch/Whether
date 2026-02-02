import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import MarketsPage from './pages/MarketsPage';
import MarketDetailPage from './pages/MarketDetailPage';
import EarnPage from './pages/EarnPage';
import PortfolioPage from './pages/PortfolioPage';
import ForecastPage from './pages/ForecastPage';
import SquadsPage from './pages/SquadsPage';
import ProfilePage from './pages/ProfilePage';
import AchievementsPage from './pages/AchievementsPage';
import LeaderboardPage from './pages/LeaderboardPage';
import AgentsPage from './pages/AgentsPage';
import AgentDetailPage from './pages/AgentDetailPage';
import CreateAgentPage from './pages/CreateAgentPage';
import RulesPage from './pages/RulesPage';
import { TelegramAuthProvider } from './providers/TelegramAuthProvider';
import { useTelegramApp } from './hooks/useTelegramApp';
import { setLanguageFromTelegram } from './i18n';

function App() {
    const { webApp, ready, user } = useTelegramApp();

    useEffect(() => {
        if (webApp && ready) {
            webApp.expand();
            webApp.enableClosingConfirmation();
            // Set language from Telegram user preferences
            setLanguageFromTelegram(user?.language_code);
        }
    }, [webApp, ready, user?.language_code]);

    return (
        <TelegramAuthProvider>
            <Layout>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/forecast" element={<ForecastPage />} />
                    <Route path="/markets" element={<MarketsPage />} />
                    <Route path="/markets/:marketId" element={<MarketDetailPage />} />
                    <Route path="/earn" element={<EarnPage />} />
                    <Route path="/portfolio" element={<PortfolioPage />} />
                    <Route path="/squads" element={<SquadsPage />} />
                    <Route path="/squads/:squadId" element={<SquadsPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/achievements" element={<AchievementsPage />} />
                    <Route path="/leaderboard" element={<LeaderboardPage />} />
                    <Route path="/agents" element={<AgentsPage />} />
                    <Route path="/agents/create" element={<CreateAgentPage />} />
                    <Route path="/agents/:agentId" element={<AgentDetailPage />} />
                    <Route path="/rules" element={<RulesPage />} />
                </Routes>
            </Layout>
        </TelegramAuthProvider>
    );
}

export default App;
