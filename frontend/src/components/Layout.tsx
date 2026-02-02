import { ReactNode, useEffect } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTelegramApp } from '../hooks/useTelegramApp';
import WalletButton from './WalletButton';
import ForecastCarousel from './ForecastCarousel';
import './Layout.css';

interface LayoutProps {
    children: ReactNode;
}

function Layout({ children }: LayoutProps) {
    const { t } = useTranslation();
    const { webApp, ready } = useTelegramApp();
    const location = useLocation();
    const navigate = useNavigate();

    // Handle Telegram Back Button
    useEffect(() => {
        if (!ready || !webApp) return;

        // Set Header Color to match Deep Space theme
        webApp.setHeaderColor('#05070A');
        webApp.setBackgroundColor('#05070A');

        const backButton = webApp.BackButton;

        if (location.pathname !== '/' && location.pathname !== '/forecast' && location.pathname !== '/markets') {
            backButton.show();
            backButton.onClick(() => navigate(-1));
        } else {
            backButton.hide();
        }

        return () => {
            backButton.offClick(() => navigate(-1));
        };
    }, [webApp, ready, location.pathname, navigate]);

    return (
        <div className="layout">
            <header className="header glass-panel">
                <div className="header-mesh"></div>
                <div className="header-content">
                    <div className="header-left">
                        <Link to="/forecast" className="logo-link">
                            <img src="/whether_logo.png" alt="Whether" className="logo-image" />
                        </Link>
                        <ForecastCarousel />
                    </div>
                    <WalletButton />
                </div>
            </header>

            <main className="main">{children}</main>

            <nav className="nav">
                <NavLink to="/forecast" className={({ isActive }) => `nav-item ${isActive || location.pathname === '/' ? 'active' : ''}`}>
                    <img src="/assets/weather/rain.png" alt="Forecast" className="nav-icon-img" />
                    <span className="nav-label">{t('nav.forecast')}</span>
                </NavLink>
                <NavLink to="/markets" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <img src="/assets/weather/chart.png" alt="Markets" className="nav-icon-img" />
                    <span className="nav-label">{t('nav.markets')}</span>
                </NavLink>
                <NavLink to="/squads" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <img src="/assets/weather/users.png" alt="Squads" className="nav-icon-img" />
                    <span className="nav-label">{t('nav.squads')}</span>
                </NavLink>
                <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <img src="/assets/weather/profile.png" alt="Profile" className="nav-icon-img" />
                    <span className="nav-label">{t('nav.profile')}</span>
                </NavLink>
            </nav>
        </div>
    );
}

export default Layout;
