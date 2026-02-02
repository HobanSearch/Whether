import type { TransactionPhase, TradeEstimate } from '../types';
import type { TonTransactionState } from '../hooks/useTonTransaction';
import './TransactionModal.css';

interface TransactionModalProps {
    isOpen: boolean;
    state: TonTransactionState;
    estimate?: TradeEstimate;
    side?: 'YES' | 'NO';
    onClose: () => void;
    onRetry?: () => void;
}

function getPhaseTitle(phase: TransactionPhase): string {
    switch (phase) {
        case 'preparing':
            return 'Preparing Transaction';
        case 'awaiting_signature':
            return 'Confirm in Wallet';
        case 'confirming':
            return 'Confirming...';
        case 'confirmed':
            return 'Transaction Complete';
        case 'failed':
            return 'Transaction Failed';
        default:
            return '';
    }
}

function getPhaseDescription(phase: TransactionPhase, error?: Error | null): string {
    switch (phase) {
        case 'preparing':
            return 'Building your transaction...';
        case 'awaiting_signature':
            return 'Please approve the transaction in your TON wallet';
        case 'confirming':
            return 'Waiting for blockchain confirmation';
        case 'confirmed':
            return 'Your transaction has been confirmed on the blockchain';
        case 'failed':
            if (error?.message.includes('rejected') || error?.message.includes('Cancelled')) {
                return 'Transaction was cancelled';
            }
            return error?.message || 'Something went wrong';
        default:
            return '';
    }
}

function formatTON(value: string): string {
    const num = parseFloat(value) / 1e9;
    return num.toFixed(2);
}

function TransactionModal({
    isOpen,
    state,
    estimate,
    side,
    onClose,
    onRetry,
}: TransactionModalProps) {
    if (!isOpen || state.phase === 'idle') {
        return null;
    }

    const { phase, hash, error } = state;
    const isLoading = phase === 'preparing' || phase === 'awaiting_signature' || phase === 'confirming';
    const isSuccess = phase === 'confirmed';
    const isFailed = phase === 'failed';

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && !isLoading) {
            onClose();
        }
    };

    return (
        <div className="tx-modal-overlay" onClick={handleOverlayClick}>
            <div className="tx-modal">
                <div className={`tx-modal-icon ${phase}`}>
                    {isLoading && (
                        <div className="tx-spinner">
                            <svg viewBox="0 0 50 50">
                                <circle
                                    cx="25"
                                    cy="25"
                                    r="20"
                                    fill="none"
                                    strokeWidth="4"
                                />
                            </svg>
                        </div>
                    )}
                    {phase === 'awaiting_signature' && (
                        <div className="tx-wallet-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="6" width="20" height="14" rx="2" />
                                <path d="M22 10H18C16.9 10 16 10.9 16 12C16 13.1 16.9 14 18 14H22" />
                                <circle cx="18" cy="12" r="1" fill="currentColor" />
                            </svg>
                        </div>
                    )}
                    {isSuccess && (
                        <div className="tx-success-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                    )}
                    {isFailed && (
                        <div className="tx-error-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </div>
                    )}
                </div>

                <h3 className="tx-modal-title">{getPhaseTitle(phase)}</h3>
                <p className="tx-modal-description">{getPhaseDescription(phase, error)}</p>

                {estimate && phase !== 'confirmed' && phase !== 'failed' && (
                    <div className="tx-modal-details">
                        <div className="tx-detail-row">
                            <span className="tx-detail-label">Amount</span>
                            <span className="tx-detail-value">
                                {formatTON(estimate.inputAmount)} TON
                            </span>
                        </div>
                        <div className="tx-detail-row">
                            <span className="tx-detail-label">You receive</span>
                            <span className={`tx-detail-value ${side?.toLowerCase()}`}>
                                {parseFloat(estimate.outputTokens).toFixed(2)} {side} tokens
                            </span>
                        </div>
                        {estimate.priceImpact > 0.5 && (
                            <div className="tx-detail-row warning">
                                <span className="tx-detail-label">Price Impact</span>
                                <span className="tx-detail-value">
                                    {estimate.priceImpact.toFixed(2)}%
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {isSuccess && estimate && (
                    <div className="tx-modal-details success">
                        <div className="tx-detail-row">
                            <span className="tx-detail-label">Received</span>
                            <span className={`tx-detail-value ${side?.toLowerCase()}`}>
                                {parseFloat(estimate.outputTokens).toFixed(2)} {side} tokens
                            </span>
                        </div>
                    </div>
                )}

                {hash && (
                    <a
                        href={`https://tonviewer.com/transaction/${hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tx-modal-hash"
                    >
                        View on explorer
                    </a>
                )}

                <div className="tx-modal-actions">
                    {isFailed && onRetry && (
                        <button className="tx-btn retry" onClick={onRetry}>
                            Try Again
                        </button>
                    )}
                    {(isSuccess || isFailed) && (
                        <button
                            className={`tx-btn ${isFailed ? 'secondary' : 'primary'}`}
                            onClick={onClose}
                        >
                            {isSuccess ? 'Done' : 'Close'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default TransactionModal;
