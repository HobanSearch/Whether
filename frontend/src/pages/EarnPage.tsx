import { useState, useMemo } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { useTelegramApp } from '../hooks/useTelegramApp';
import { useLiquidity, useDepositEstimate, useWithdrawEstimate } from '../hooks/useLiquidity';
import './EarnPage.css';

const NANO_TON = 1_000_000_000n;
const MIN_DEPOSIT_TON = 1;

function formatTonDisplay(nanoTon: string | bigint | undefined): string {
    if (!nanoTon) return '0.00';
    const value = typeof nanoTon === 'string' ? BigInt(nanoTon) : nanoTon;
    const ton = Number(value) / Number(NANO_TON);
    if (ton >= 1_000_000) return `${(ton / 1_000_000).toFixed(2)}M`;
    if (ton >= 1_000) return `${(ton / 1_000).toFixed(2)}K`;
    return ton.toFixed(2);
}

function EarnPage() {
    const [tonConnectUI] = useTonConnectUI();
    const address = useTonAddress();
    useTelegramApp();
    const [action, setAction] = useState<'deposit' | 'withdraw'>('deposit');
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const { poolStats, position, prepareDeposit, prepareWithdraw, invalidateQueries } = useLiquidity(address);

    const amountInNano = useMemo(() => {
        if (!amount || isNaN(parseFloat(amount))) return undefined;
        return String(BigInt(Math.floor(parseFloat(amount) * Number(NANO_TON))));
    }, [amount]);

    const sharesInNano = useMemo(() => {
        if (!position.data?.shares || !amount || isNaN(parseFloat(amount))) return undefined;
        const maxShares = BigInt(position.data.shares);
        const requestedPercent = parseFloat(amount);
        if (requestedPercent >= 100) return String(maxShares);
        return String((maxShares * BigInt(Math.floor(requestedPercent * 100))) / 10000n);
    }, [amount, position.data?.shares]);

    const depositEstimate = useDepositEstimate(action === 'deposit' ? amountInNano : undefined);
    const withdrawEstimate = useWithdrawEstimate(action === 'withdraw' ? sharesInNano : undefined);

    const handleDeposit = async () => {
        if (!address || !amountInNano) return;

        const tonAmount = parseFloat(amount);
        if (tonAmount < MIN_DEPOSIT_TON) {
            setError(`Minimum deposit is ${MIN_DEPOSIT_TON} TON`);
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await prepareDeposit.mutateAsync({
                walletAddress: address,
                amount: amountInNano,
            });

            await tonConnectUI.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 600,
                messages: [{
                    address: result.transaction.to,
                    amount: result.transaction.value,
                    payload: result.transaction.payload,
                }],
            });

            setSuccess(`Deposit of ${amount} TON submitted!`);
            setAmount('');
            invalidateQueries();
        } catch (err) {
            console.error('Deposit error:', err);
            setError(err instanceof Error ? err.message : 'Deposit failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleWithdraw = async () => {
        if (!address || !sharesInNano) return;

        setIsSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await prepareWithdraw.mutateAsync({
                walletAddress: address,
                shares: sharesInNano,
            });

            await tonConnectUI.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 600,
                messages: [{
                    address: result.transaction.to,
                    amount: result.transaction.value,
                    payload: result.transaction.payload,
                }],
            });

            setSuccess('Withdrawal submitted!');
            setAmount('');
            invalidateQueries();
        } catch (err) {
            console.error('Withdraw error:', err);
            setError(err instanceof Error ? err.message : 'Withdrawal failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAction = () => {
        if (action === 'deposit') {
            handleDeposit();
        } else {
            handleWithdraw();
        }
    };

    const handleMaxWithdraw = () => {
        setAmount('100');
    };

    const isLoading = poolStats.isLoading || position.isLoading;
    const hasPosition = position.data && BigInt(position.data.shares || '0') > 0n;

    return (
        <div className="container earn-container">
            <header className="earn-header glass-panel">
                <div className="header-title">
                    <h2 className="text-lg">Global Weather Fund</h2>
                    <p className="text-hint text-sm">Provide liquidity, earn yield</p>
                </div>
                <div className="apy-display">
                    <span className="apy-label">APY</span>
                    <span className="apy-value">
                        {isLoading ? '...' : `${poolStats.data?.apy.toFixed(1)}%`}
                    </span>
                </div>
            </header>

            {address && (
                <section className="liquidity-card glass-panel">
                    <h3 className="section-title text-hint text-xs">YOUR POSITION</h3>
                    {position.isLoading ? (
                        <div className="loading-skeleton">Loading position...</div>
                    ) : hasPosition ? (
                        <div className="liquidity-stats">
                            <div className="stat-row">
                                <span className="stat-label">LP Shares</span>
                                <span className="stat-value text-mono">
                                    {position.data?.shares_formatted || '0'} shares
                                </span>
                            </div>
                            <div className="stat-row">
                                <span className="stat-label">Deposited Value</span>
                                <span className="stat-value text-mono">
                                    {position.data?.deposited_formatted || '0'} TON
                                </span>
                            </div>
                            <div className="stat-row">
                                <span className="stat-label">Current Value</span>
                                <span className="stat-value text-mono">
                                    {position.data?.current_value_formatted || '0'} TON
                                </span>
                            </div>
                            <div className="stat-row">
                                <span className="stat-label">Earnings</span>
                                <span className="stat-value text-mono text-success">
                                    +{position.data?.earnings_formatted || '0'} TON
                                </span>
                            </div>
                            <div className="stat-row">
                                <span className="stat-label">Share of Pool</span>
                                <span className="stat-value text-mono">
                                    {position.data?.share_of_pool.toFixed(4) || '0'}%
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="no-position">
                            <p className="text-hint text-sm">No liquidity provided yet</p>
                            <p className="text-hint text-xs">Deposit TON to start earning yield</p>
                        </div>
                    )}
                </section>
            )}

            <section className="action-section glass-panel">
                <div className="action-tabs">
                    <button
                        className={`tab-btn ${action === 'deposit' ? 'active' : ''}`}
                        onClick={() => { setAction('deposit'); setAmount(''); setError(null); }}
                    >
                        Deposit
                    </button>
                    <button
                        className={`tab-btn ${action === 'withdraw' ? 'active' : ''}`}
                        onClick={() => { setAction('withdraw'); setAmount(''); setError(null); }}
                        disabled={!hasPosition}
                    >
                        Withdraw
                    </button>
                </div>

                <div className="deposit-form">
                    <div className="input-container">
                        <input
                            type="number"
                            className="amount-input"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={action === 'deposit' ? '0.00' : '0'}
                            disabled={isSubmitting}
                        />
                        <span className="input-suffix">
                            {action === 'deposit' ? 'TON' : '%'}
                        </span>
                        {action === 'withdraw' && hasPosition && (
                            <button
                                className="max-btn"
                                onClick={handleMaxWithdraw}
                                disabled={isSubmitting}
                            >
                                MAX
                            </button>
                        )}
                    </div>

                    {action === 'deposit' && depositEstimate.data && parseFloat(amount) > 0 && (
                        <div className="estimate-preview">
                            <div className="estimate-row">
                                <span>Shares to receive</span>
                                <span>{formatTonDisplay(depositEstimate.data.shares_to_receive)}</span>
                            </div>
                            <div className="estimate-row">
                                <span>Share of pool after</span>
                                <span>{depositEstimate.data.share_of_pool_after.toFixed(4)}%</span>
                            </div>
                        </div>
                    )}

                    {action === 'withdraw' && withdrawEstimate.data && parseFloat(amount) > 0 && (
                        <div className="estimate-preview">
                            <div className="estimate-row">
                                <span>Amount to receive</span>
                                <span>{formatTonDisplay(withdrawEstimate.data.net_amount)} TON</span>
                            </div>
                            {BigInt(withdrawEstimate.data.fee || '0') > 0n && (
                                <div className="estimate-row text-hint">
                                    <span>Withdrawal fee</span>
                                    <span>{formatTonDisplay(withdrawEstimate.data.fee)} TON</span>
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="success-message">
                            {success}
                        </div>
                    )}

                    {!address ? (
                        <button
                            className="btn btn-primary btn-full"
                            onClick={() => tonConnectUI.openModal()}
                        >
                            Connect Wallet
                        </button>
                    ) : (
                        <button
                            className="btn btn-primary btn-full"
                            onClick={handleAction}
                            disabled={
                                isSubmitting ||
                                !amount ||
                                parseFloat(amount) <= 0 ||
                                (action === 'deposit' && parseFloat(amount) < MIN_DEPOSIT_TON) ||
                                (action === 'withdraw' && !hasPosition)
                            }
                        >
                            {isSubmitting
                                ? 'Processing...'
                                : action === 'deposit'
                                    ? `Deposit ${amount || '0'} TON`
                                    : `Withdraw ${amount || '0'}%`
                            }
                        </button>
                    )}

                    {action === 'deposit' && (
                        <p className="form-hint text-hint text-xs">
                            Minimum deposit: {MIN_DEPOSIT_TON} TON
                        </p>
                    )}
                </div>
            </section>

            <section className="fund-stats-section mt-md">
                <h4 className="section-title text-hint mb-sm">FUND STATS</h4>
                <div className="glass-panel p-md">
                    {poolStats.isLoading ? (
                        <div className="loading-skeleton">Loading stats...</div>
                    ) : (
                        <>
                            <div className="flex justify-between items-center mb-sm">
                                <span className="text-hint">Total Value Locked</span>
                                <span className="text-mono">
                                    {poolStats.data?.tvl_formatted || '0'} TON
                                </span>
                            </div>
                            <div className="flex justify-between items-center mb-sm">
                                <span className="text-hint">Total Fees Collected</span>
                                <span className="text-mono">
                                    {formatTonDisplay(poolStats.data?.total_fees_collected)} TON
                                </span>
                            </div>
                            <div className="flex justify-between items-center mb-sm">
                                <span className="text-hint">Share Price</span>
                                <span className="text-mono">
                                    {poolStats.data?.share_price
                                        ? (Number(poolStats.data.share_price) / Number(NANO_TON)).toFixed(6)
                                        : '1.000000'
                                    }
                                </span>
                            </div>
                            <div className="flex justify-between items-center mb-sm">
                                <span className="text-hint">7-Day APY</span>
                                <span className="text-mono">
                                    {poolStats.data?.apy_7d.toFixed(1) || '0'}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-hint">Liquidity Providers</span>
                                <span className="text-mono">
                                    {poolStats.data?.lp_count.toLocaleString() || '0'}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </section>

            <section className="info-section mt-md">
                <h4 className="section-title text-hint mb-sm">HOW IT WORKS</h4>
                <div className="glass-panel p-md">
                    <div className="info-item mb-sm">
                        <span className="info-icon">1</span>
                        <p className="text-sm">Deposit TON to receive LP shares representing your pool ownership</p>
                    </div>
                    <div className="info-item mb-sm">
                        <span className="info-icon">2</span>
                        <p className="text-sm">Earn yield from trading fees (35 bps per market settlement)</p>
                    </div>
                    <div className="info-item">
                        <span className="info-icon">3</span>
                        <p className="text-sm">Withdraw anytime - no lock period. Share price grows with fees.</p>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default EarnPage;
