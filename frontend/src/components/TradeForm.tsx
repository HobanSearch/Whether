import { useState, useEffect, useCallback } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { useTranslation } from 'react-i18next';
import {
    useRealTimeOdds,
    useTradeEstimate,
    usePrepareBet,
    useInvalidateMarketQueries,
} from '../hooks/useMarkets';
import { useTonTransaction } from '../hooks/useTonTransaction';
import { useTelegramApp } from '../hooks/useTelegramApp';
import { formatPercent, getMarketIcons, safeBigIntToNumber } from '../utils/format';
import TransactionModal from './TransactionModal';
import type { Market, TradeEstimate } from '../types';
import './TradeForm.css';

interface TradeFormProps {
    market: Market;
}

function TradeForm({ market }: TradeFormProps) {
    const { t } = useTranslation();
    const address = useTonAddress();
    const [tonConnectUI] = useTonConnectUI();
    const { hapticFeedback, showAlert, webApp, isTelegram } = useTelegramApp();
    const invalidateQueries = useInvalidateMarketQueries();

    // Real-time odds polling (2s when visible, 60s when hidden)
    const { data: odds } = useRealTimeOdds(market.id);

    const isBracket = market.marketType === 'bracket';
    const isScalar = market.marketType === 'scalar';

    const [side, setSide] = useState<'YES' | 'NO'>('YES');
    const [selectedBracket, setSelectedBracket] = useState<string | null>(null);
    const [amount, setAmount] = useState('');
    const [slippage, setSlippage] = useState(0.5);
    const [showModal, setShowModal] = useState(false);
    const [lastEstimate, setLastEstimate] = useState<TradeEstimate | null>(null);

    // Get bracket index for estimate (use 0 as default "YES" for bracket markets when selected)
    const selectedBracketIndex = selectedBracket
        ? market.brackets?.findIndex(b => b.id === selectedBracket)
        : undefined;

    // Server-side trade estimate (debounced) - works for both binary and bracket markets
    const { data: estimate, isLoading: isEstimating } = useTradeEstimate(
        market.id,
        isBracket ? 'YES' : side, // For bracket markets, side is always effectively YES on the selected bracket
        amount,
        parseFloat(amount) > 0 && (!isBracket || selectedBracket !== null),
        isBracket ? selectedBracketIndex : undefined
    );

    // Prepare bet mutation
    const prepareBet = usePrepareBet();

    // Transaction hook for TON Connect
    const txState = useTonTransaction({
        onSuccess: () => {
            invalidateQueries(market.id);
            setAmount('');
            setSelectedBracket(null);
        },
        onError: () => {
            // Error is handled by the modal
        },
    });

    // Use real-time odds if available, fallback to market data
    const yesPrice = odds?.yesPct ? odds.yesPct / 100 : market.yesPrice;
    const noPrice = odds?.noPct ? odds.noPct / 100 : market.noPrice;
    const currentPrice = side === 'YES' ? yesPrice : noPrice;

    // Calculate display values from server estimate
    const estimatedOutput = estimate?.outputTokens
        ? parseFloat(estimate.outputTokens)
        : 0;
    const minOutput = estimate?.minOutput
        ? parseFloat(estimate.minOutput)
        : 0;
    const priceImpact = estimate?.priceImpact ?? 0;
    const effectivePrice = estimate?.effectivePrice ?? currentPrice;

    const amountNum = parseFloat(amount) || 0;
    const isValidAmount = amountNum > 0;

    const handleSubmit = useCallback(async () => {
        if (!address) {
            // Open wallet connection modal
            await tonConnectUI.openModal();
            return;
        }

        if (!isValidAmount) {
            showAlert('Please enter an amount');
            return;
        }

        if (isBracket && !selectedBracket) {
            showAlert('Please select a bracket');
            return;
        }

        hapticFeedback('medium');
        setShowModal(true);

        try {
            // Step 1: Prepare the transaction on backend
            const result = await prepareBet.mutateAsync({
                marketId: market.id,
                request: {
                    side,
                    amount: (amountNum * 1e9).toString(),
                    slippage,
                    bracketIndex: selectedBracket
                        ? market.brackets?.findIndex(b => b.id === selectedBracket)
                        : undefined,
                },
            });

            // Store estimate for modal display
            setLastEstimate(result.estimate);

            // Step 2: Send transaction via TON Connect
            await txState.sendTransaction(result.transaction);

        } catch (error) {
            hapticFeedback('error');
            if (error instanceof Error && !error.message.includes('rejected')) {
                showAlert('Failed to prepare transaction');
            }
            setShowModal(false);
        }
    }, [
        address,
        tonConnectUI,
        isValidAmount,
        isBracket,
        selectedBracket,
        hapticFeedback,
        showAlert,
        prepareBet,
        market.id,
        market.brackets,
        side,
        amountNum,
        slippage,
        txState,
    ]);

    const handleCloseModal = useCallback(() => {
        setShowModal(false);
        txState.reset();
        setLastEstimate(null);
    }, [txState]);

    const handleRetry = useCallback(() => {
        txState.reset();
        handleSubmit();
    }, [txState, handleSubmit]);

    // MainButton Integration
    useEffect(() => {
        if (!webApp) return;

        const mainButton = webApp.MainButton;
        mainButton.show();

        const isProcessing = prepareBet.isPending || txState.state.phase !== 'idle';

        if (isProcessing) {
            mainButton.showProgress();
            mainButton.disable();
            if (txState.state.phase === 'awaiting_signature') {
                mainButton.setText('CONFIRM IN WALLET');
            } else if (txState.state.phase === 'confirming') {
                mainButton.setText('CONFIRMING...');
            } else {
                mainButton.setText('PROCESSING...');
            }
        } else {
            mainButton.hideProgress();
            if (!address) {
                mainButton.setText('CONNECT WALLET');
                mainButton.enable();
            } else if (isBracket && !selectedBracket) {
                mainButton.setText('SELECT BRACKET');
                mainButton.disable();
            } else if (!isValidAmount) {
                mainButton.setText('ENTER AMOUNT');
                mainButton.disable();
            } else {
                mainButton.enable();
                if (isBracket) {
                    const bracket = market.brackets?.find(b => b.id === selectedBracket);
                    mainButton.setParams({
                        text: `BET ON ${bracket?.label || 'BRACKET'} - ${amount} TON`,
                        color: '#8a2be2',
                        text_color: '#ffffff'
                    });
                } else {
                    const sideColor = side === 'YES' ? '#00F0FF' : '#FF5C00';
                    const sideLabel = isScalar ? (side === 'YES' ? 'LONG' : 'SHORT') : side;
                    mainButton.setParams({
                        text: `BUY ${sideLabel} - ${amount} TON`,
                        color: sideColor,
                        text_color: '#000000'
                    });
                }
            }
        }

        mainButton.onClick(handleSubmit);

        return () => {
            mainButton.offClick(handleSubmit);
            mainButton.hide();
            mainButton.hideProgress();
            mainButton.setParams({
                color: '#2481cc',
                text_color: '#ffffff'
            });
        };
    }, [
        webApp,
        address,
        isValidAmount,
        side,
        selectedBracket,
        isBracket,
        isScalar,
        prepareBet.isPending,
        txState.state.phase,
        amount,
        market.brackets,
        handleSubmit,
    ]);

    const isDisabled = !address || !isValidAmount || prepareBet.isPending ||
        txState.state.phase !== 'idle' || (isBracket && !selectedBracket);

    const renderBracketSelector = () => {
        const brackets = market.brackets || [];
        const totalStaked = brackets.reduce((sum, b) => sum + safeBigIntToNumber(b.totalStaked), 0);

        return (
            <div className="bracket-selector">
                {brackets.map((bracket, idx) => {
                    const probability = totalStaked > 0
                        ? safeBigIntToNumber(bracket.totalStaked) / totalStaked
                        : 1 / brackets.length;

                    return (
                        <button
                            key={bracket.id}
                            className={`bracket-btn ${selectedBracket === bracket.id ? 'active' : ''} rank-${idx + 1}`}
                            onClick={() => {
                                setSelectedBracket(bracket.id);
                                hapticFeedback('selection');
                            }}
                        >
                            <span className="bracket-range">{bracket.label}</span>
                            <span className="bracket-odds">{formatPercent(probability)}</span>
                        </button>
                    );
                })}
            </div>
        );
    };

    const renderSideSelector = () => {
        const icons = getMarketIcons(market.resolutionType);
        return (
            <div className="side-selector">
                <button
                    className={`side-btn yes ${side === 'YES' ? 'active' : ''}`}
                    onClick={() => {
                        setSide('YES');
                        hapticFeedback('selection');
                    }}
                >
                    <img src={icons.yesIcon} alt={icons.yesLabel} className="side-icon-img" />
                    {isScalar ? 'Long' : `${t('trading.buy')} ${icons.yesLabel}`}
                    <span className="side-price">{formatPercent(yesPrice)}</span>
                </button>
                <button
                    className={`side-btn no ${side === 'NO' ? 'active' : ''}`}
                    onClick={() => {
                        setSide('NO');
                        hapticFeedback('selection');
                    }}
                >
                    <img src={icons.noIcon} alt={icons.noLabel} className="side-icon-img" />
                    {isScalar ? 'Short' : `${t('trading.buy')} ${icons.noLabel}`}
                    <span className="side-price">{formatPercent(noPrice)}</span>
                </button>
            </div>
        );
    };

    return (
        <>
            <div className={`trade-form ${isBracket ? 'bracket-mode' : ''}`}>
                {isBracket ? renderBracketSelector() : renderSideSelector()}

                <div className="input-group">
                    <label className="input-label">{t('market.amount')} (TON)</label>
                    <div className="slider-container">
                        <input
                            type="range"
                            min="1"
                            max="100"
                            step="1"
                            value={amount || 0}
                            onChange={(e) => {
                                setAmount(e.target.value);
                                hapticFeedback('selection');
                            }}
                            className="conviction-slider"
                        />
                        <div className="slider-labels">
                            <span>1</span>
                            <span>50</span>
                            <span>100</span>
                        </div>
                    </div>
                    <input
                        type="number"
                        className="input amount-display"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="0.1"
                    />
                </div>

                <div className="trade-summary">
                    {isBracket ? (
                        <>
                            <div className="summary-row">
                                <span>{t('market.outcome')}</span>
                                <span className="summary-value bracket-selected">
                                    {selectedBracket
                                        ? market.brackets?.find(b => b.id === selectedBracket)?.label || 'Bracket'
                                        : '—'}
                                </span>
                            </div>
                            <div className="summary-row">
                                <span>{t('market.amount')}</span>
                                <span className="summary-value">{amount || '0'} TON</span>
                            </div>
                            {selectedBracket && parseFloat(amount) > 0 && (
                                <>
                                    <div className="summary-row">
                                        <span>{t('market.estimatedReturn')}</span>
                                        <span className={`summary-value ${isEstimating ? 'loading' : ''}`}>
                                            {isEstimating ? (
                                                '...'
                                            ) : (
                                                `~${estimatedOutput.toFixed(2)} tokens`
                                            )}
                                        </span>
                                    </div>
                                    <div className="summary-row">
                                        <span>{t('trading.price')}</span>
                                        <span className="summary-value">
                                            {isEstimating ? '...' : formatPercent(effectivePrice)}
                                        </span>
                                    </div>
                                    <div className="summary-row">
                                        <span>{t('market.priceImpact')}</span>
                                        <span className={`summary-value ${priceImpact > 2 ? 'warning' : ''}`}>
                                            {isEstimating ? '...' : `${priceImpact.toFixed(2)}%`}
                                        </span>
                                    </div>
                                    <div className="summary-row">
                                        <span>{t('trading.minReceived')}</span>
                                        <span className="summary-value">
                                            {isEstimating ? '...' : minOutput.toFixed(2)}
                                        </span>
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="summary-row">
                                <span>{t('market.estimatedReturn')}</span>
                                <span className={`summary-value ${isEstimating ? 'loading' : ''}`}>
                                    {isEstimating ? (
                                        '...'
                                    ) : (
                                        `~${estimatedOutput.toFixed(2)} ${isScalar ? (side === 'YES' ? 'LONG' : 'SHORT') : side}`
                                    )}
                                </span>
                            </div>
                            <div className="summary-row">
                                <span>{t('trading.price')}</span>
                                <span className="summary-value">{formatPercent(effectivePrice)}</span>
                            </div>
                            <div className="summary-row">
                                <span>{t('market.priceImpact')}</span>
                                <span className={`summary-value ${priceImpact > 2 ? 'warning' : ''}`}>
                                    {priceImpact.toFixed(2)}%
                                </span>
                            </div>
                            <div className="summary-row">
                                <span>{t('trading.minReceived')}</span>
                                <span className="summary-value">{minOutput.toFixed(2)}</span>
                            </div>
                        </>
                    )}
                </div>

                <div className="slippage-selector">
                    <span className="slippage-label">{t('market.slippage')}</span>
                    <div className="slippage-options">
                        {[0.5, 1, 2].map((s) => (
                            <button
                                key={s}
                                className={`slippage-btn ${slippage === s ? 'active' : ''}`}
                                onClick={() => setSlippage(s)}
                            >
                                {s}%
                            </button>
                        ))}
                    </div>
                </div>

                {/* Submit button for non-Telegram web fallback */}
                {!isTelegram && (
                    <button
                        className={`submit-btn ${isBracket ? 'bracket' : side.toLowerCase()}`}
                        onClick={handleSubmit}
                        disabled={isDisabled}
                    >
                        {prepareBet.isPending || txState.state.phase !== 'idle' ? (
                            <span className="loading-spinner" />
                        ) : !address ? (
                            t('common.connectWallet')
                        ) : isBracket ? (
                            selectedBracket
                                ? `${market.brackets?.find(b => b.id === selectedBracket)?.label || 'Bracket'}`
                                : t('market.placeBet')
                        ) : isScalar ? (
                            `${side === 'YES' ? 'Long' : 'Short'}`
                        ) : (
                            `${t('trading.buy')} ${side}`
                        )}
                    </button>
                )}
            </div>

            <TransactionModal
                isOpen={showModal}
                state={txState.state}
                estimate={lastEstimate || estimate}
                side={side}
                onClose={handleCloseModal}
                onRetry={handleRetry}
            />
        </>
    );
}

export default TradeForm;
