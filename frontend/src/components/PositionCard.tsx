import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTonAddress } from '@tonconnect/ui-react';
import { usePrepareClaim, usePrepareRefund, useInvalidateMarketQueries, useSubmitDispute } from '../hooks/useMarkets';
import { useTonTransaction } from '../hooks/useTonTransaction';
import { useTelegramApp } from '../hooks/useTelegramApp';
import { formatTon, formatPercent } from '../utils/format';
import TransactionModal from './TransactionModal';
import DisputeModal from './DisputeModal';
import type { Position } from '../types';
import './PositionCard.css';

interface PositionCardProps {
    position: Position;
    locationName?: string;
}

function PositionCard({ position, locationName }: PositionCardProps) {
    const address = useTonAddress();
    const { hapticFeedback } = useTelegramApp();
    const invalidateQueries = useInvalidateMarketQueries();

    const [showModal, setShowModal] = useState(false);
    const [showDisputeModal, setShowDisputeModal] = useState(false);
    const [actionType, setActionType] = useState<'claim' | 'refund'>('claim');

    const prepareClaim = usePrepareClaim();
    const prepareRefund = usePrepareRefund();
    const submitDispute = useSubmitDispute();

    const txState = useTonTransaction({
        onSuccess: () => {
            invalidateQueries(position.marketId);
        },
    });

    const { market } = position;
    const isSettled = market.status === 'settled';
    const isCancelled = market.status === 'cancelled';
    const hasYes = position.yesBalance > 0n;
    const hasNo = position.noBalance > 0n;

    // Determine if user won
    const yesWon = isSettled && market.outcome === 'YES';
    const noWon = isSettled && market.outcome === 'NO';
    const userWon = (yesWon && hasYes) || (noWon && hasNo);
    const userLost = isSettled && !userWon && (hasYes || hasNo);

    // Can claim if settled and user holds winning tokens
    const canClaimYes = yesWon && hasYes && position.status !== 'claimed';
    const canClaimNo = noWon && hasNo && position.status !== 'claimed';
    const canClaim = canClaimYes || canClaimNo;

    // Can refund if market cancelled
    const canRefund = isCancelled && (hasYes || hasNo) && position.status !== 'refunded';

    // Can dispute if settled recently (within 1 hour) and user lost
    const settlementTime = market.settledAt ? market.settledAt * 1000 : 0;
    const disputeWindowEnd = settlementTime + (60 * 60 * 1000); // 1 hour after settlement
    const canDispute = isSettled && userLost && Date.now() < disputeWindowEnd && position.status !== 'claimed';

    // Calculate estimated payout
    const estimatedPayout = canClaimYes
        ? position.yesBalance
        : canClaimNo
            ? position.noBalance
            : 0n;

    const handleClaim = useCallback(async () => {
        if (!address) return;

        setActionType('claim');
        setShowModal(true);
        hapticFeedback('medium');

        try {
            const result = await prepareClaim.mutateAsync({
                marketId: position.marketId,
                request: { userAddress: address },
            });

            if (result.transaction) {
                await txState.sendTransaction(result.transaction);
            }
        } catch (error) {
            hapticFeedback('error');
            setShowModal(false);
        }
    }, [address, hapticFeedback, prepareClaim, position.marketId, txState]);

    const handleRefund = useCallback(async () => {
        if (!address) return;

        setActionType('refund');
        setShowModal(true);
        hapticFeedback('medium');

        try {
            const result = await prepareRefund.mutateAsync({
                marketId: position.marketId,
                userAddress: address,
            });

            if (result.transaction) {
                await txState.sendTransaction({
                    to: result.transaction.to,
                    value: result.transaction.value,
                    payload: result.transaction.payload,
                });
            }
        } catch (error) {
            hapticFeedback('error');
            setShowModal(false);
        }
    }, [address, hapticFeedback, prepareRefund, position.marketId, txState]);

    const handleCloseModal = useCallback(() => {
        setShowModal(false);
        txState.reset();
    }, [txState]);

    const handleSubmitDispute = useCallback(async (reason: string, evidence: string) => {
        if (!address) return;

        await submitDispute.mutateAsync({
            marketId: position.marketId,
            userAddress: address,
            reason,
            evidence,
        });
    }, [address, submitDispute, position.marketId]);

    const isProcessing = prepareClaim.isPending || prepareRefund.isPending ||
        submitDispute.isPending || txState.state.phase !== 'idle';

    // Build claim estimate for modal
    const claimEstimate = canClaim ? {
        inputAmount: '0',
        outputTokens: formatTon(estimatedPayout),
        minOutput: formatTon(estimatedPayout),
        priceImpact: 0,
        effectivePrice: 1,
        yesPriceAfter: 0,
        noPriceAfter: 0,
    } : undefined;

    return (
        <>
            <div className={`position-card card ${userWon ? 'winner' : ''} ${userLost ? 'loser' : ''}`}>
                <Link to={`/markets/${position.marketId}`} className="position-header">
                    <span className="position-location">
                        {locationName || market.location}
                    </span>
                    <div className="position-badges">
                        {userWon && (
                            <span className="badge winner-badge">WON</span>
                        )}
                        {userLost && (
                            <span className="badge loser-badge">LOST</span>
                        )}
                        <span className={`position-status ${market.status}`}>
                            {market.status.toUpperCase()}
                        </span>
                    </div>
                </Link>

                <div className="position-question">{market.question}</div>

                {isSettled && market.observedValue !== undefined && (
                    <div className="position-result">
                        <span className="result-label">Actual:</span>
                        <span className="result-value">{market.observedValue}°F</span>
                        <span className={`result-outcome ${market.outcome?.toLowerCase()}`}>
                            {market.outcome}
                        </span>
                    </div>
                )}

                <div className="position-holdings">
                    {hasYes && (
                        <div className={`holding yes ${yesWon ? 'winner' : noWon ? 'loser' : ''}`}>
                            <span className="holding-label">
                                YES
                                {yesWon && <span className="win-indicator">✓</span>}
                            </span>
                            <span className="holding-amount">
                                {formatTon(position.yesBalance)}
                            </span>
                            <span className="holding-value">
                                @ {formatPercent(position.avgYesPrice ?? market.yesPrice)}
                            </span>
                        </div>
                    )}
                    {hasNo && (
                        <div className={`holding no ${noWon ? 'winner' : yesWon ? 'loser' : ''}`}>
                            <span className="holding-label">
                                NO
                                {noWon && <span className="win-indicator">✓</span>}
                            </span>
                            <span className="holding-amount">
                                {formatTon(position.noBalance)}
                            </span>
                            <span className="holding-value">
                                @ {formatPercent(position.avgNoPrice ?? market.noPrice)}
                            </span>
                        </div>
                    )}
                </div>

                {position.unrealizedPnl !== undefined && !isSettled && (
                    <div className="position-pnl">
                        <span className="pnl-label">Unrealized P&L</span>
                        <span className={`pnl-value ${position.unrealizedPnl >= 0 ? 'positive' : 'negative'}`}>
                            {position.unrealizedPnl >= 0 ? '+' : ''}
                            {position.unrealizedPnl.toFixed(2)}%
                        </span>
                    </div>
                )}

                {canClaim && (
                    <div className="position-actions">
                        <button
                            className="btn btn-success btn-full claim-btn"
                            onClick={handleClaim}
                            disabled={isProcessing}
                        >
                            {isProcessing && actionType === 'claim' ? (
                                <span className="loading-spinner small" />
                            ) : (
                                <>
                                    Claim {formatTon(estimatedPayout)} TON
                                </>
                            )}
                        </button>
                    </div>
                )}

                {canRefund && (
                    <div className="position-actions">
                        <button
                            className="btn btn-secondary btn-full refund-btn"
                            onClick={handleRefund}
                            disabled={isProcessing}
                        >
                            {isProcessing && actionType === 'refund' ? (
                                <span className="loading-spinner small" />
                            ) : (
                                'Request Refund'
                            )}
                        </button>
                    </div>
                )}

                {canDispute && (
                    <div className="position-actions">
                        <button
                            className="btn btn-warning btn-full dispute-btn"
                            onClick={() => {
                                setShowDisputeModal(true);
                                hapticFeedback('medium');
                            }}
                            disabled={isProcessing}
                        >
                            Dispute Settlement
                        </button>
                        <span className="dispute-hint">
                            Time remaining: {Math.max(0, Math.floor((disputeWindowEnd - Date.now()) / 60000))}m
                        </span>
                    </div>
                )}

                {position.status === 'claimed' && (
                    <div className="position-claimed">
                        <span className="claimed-badge">Claimed</span>
                        {position.payout !== undefined && position.payout > 0n && (
                            <span className="claimed-amount">
                                {formatTon(position.payout)} TON
                            </span>
                        )}
                    </div>
                )}
            </div>

            <TransactionModal
                isOpen={showModal}
                state={txState.state}
                estimate={claimEstimate}
                side={canClaimYes ? 'YES' : 'NO'}
                onClose={handleCloseModal}
            />

            <DisputeModal
                isOpen={showDisputeModal}
                market={market}
                onClose={() => setShowDisputeModal(false)}
                onSubmitDispute={handleSubmitDispute}
            />
        </>
    );
}

export default PositionCard;
