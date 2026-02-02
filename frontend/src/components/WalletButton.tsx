import { useTonConnectUI, useTonAddress, useTonWallet } from '@tonconnect/ui-react';
import { useTelegramApp } from '../hooks/useTelegramApp';
import './WalletButton.css';

function WalletButton() {
    const [tonConnectUI] = useTonConnectUI();
    const address = useTonAddress();
    const wallet = useTonWallet();
    const { hapticFeedback } = useTelegramApp();

    const handleConnect = async () => {
        hapticFeedback('light');
        await tonConnectUI.openModal();
    };

    const handleDisconnect = async () => {
        hapticFeedback('light');
        await tonConnectUI.disconnect();
    };

    if (wallet) {
        const shortAddress = address ? `${address.slice(0, 4)}...${address.slice(-4)}` : '';

        return (
            <button className="wallet-button connected" onClick={handleDisconnect}>
                <span className="wallet-indicator" />
                <span className="wallet-address">{shortAddress}</span>
            </button>
        );
    }

    return (
        <button className="wallet-button" onClick={handleConnect}>
            Connect Wallet
        </button>
    );
}

export default WalletButton;
