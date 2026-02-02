import { useState, useCallback } from 'react';
import { useTonAddress } from '@tonconnect/ui-react';
import { useTelegramApp } from '../hooks/useTelegramApp';
import type { Market } from '../types';
import './DisputeModal.css';

interface DisputeModalProps {
    isOpen: boolean;
    market: Market;
    onClose: () => void;
    onSubmitDispute: (reason: string, evidence: string) => Promise<void>;
}

const DISPUTE_REASONS = [
    { id: 'incorrect_data', label: 'Incorrect Weather Data', description: 'The observed weather data does not match official sources' },
    { id: 'timing_issue', label: 'Timing Issue', description: 'Data was recorded at wrong time or timezone' },
    { id: 'sensor_error', label: 'Sensor/Source Error', description: 'Primary data source had known errors' },
    { id: 'other', label: 'Other', description: 'Other reason not listed above' },
];

function DisputeModal({ isOpen, market, onClose, onSubmitDispute }: DisputeModalProps) {
    const address = useTonAddress();
    const { hapticFeedback } = useTelegramApp();

    const [selectedReason, setSelectedReason] = useState<string>('');
    const [evidence, setEvidence] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = useCallback(async () => {
        if (!selectedReason) {
            setError('Please select a reason for your dispute');
            hapticFeedback('error');
            return;
        }

        if (!evidence.trim()) {
            setError('Please provide evidence or explanation for your dispute');
            hapticFeedback('error');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await onSubmitDispute(selectedReason, evidence);
            hapticFeedback('success');
            setSubmitted(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to submit dispute');
            hapticFeedback('error');
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedReason, evidence, onSubmitDispute, hapticFeedback]);

    const handleClose = useCallback(() => {
        setSelectedReason('');
        setEvidence('');
        setError(null);
        setSubmitted(false);
        onClose();
    }, [onClose]);

    if (!isOpen) return null;

    const disputeDeadline = market.settledAt
        ? new Date((market.settledAt + 3600) * 1000) // 1 hour dispute window
        : null;

    const timeRemaining = disputeDeadline
        ? Math.max(0, disputeDeadline.getTime() - Date.now())
        : 0;

    const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

    return (
        <div className="dispute-modal-overlay" onClick={handleClose}>
            <div className="dispute-modal card" onClick={(e) => e.stopPropagation()}>
                <div className="dispute-header">
                    <h2>Dispute Settlement</h2>
                    <button className="close-btn" onClick={handleClose}>&times;</button>
                </div>

                {submitted ? (
                    <div className="dispute-success">
                        <div className="success-icon">&#10003;</div>
                        <h3>Dispute Submitted</h3>
                        <p>Your dispute has been recorded. The resolution council will review within 24 hours.</p>
                        <button className="btn btn-primary" onClick={handleClose}>
                            Close
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="dispute-info">
                            <div className="market-summary">
                                <span className="market-location">{market.location}</span>
                                <span className="market-question">{market.question}</span>
                            </div>

                            {market.observedValue !== undefined && (
                                <div className="settlement-info">
                                    <div className="settlement-row">
                                        <span className="label">Observed Value:</span>
                                        <span className="value">{market.observedValue}°F</span>
                                    </div>
                                    <div className="settlement-row">
                                        <span className="label">Outcome:</span>
                                        <span className={`value outcome-${market.outcome?.toLowerCase()}`}>
                                            {market.outcome}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {timeRemaining > 0 && (
                                <div className="dispute-deadline">
                                    <span className="deadline-label">Dispute window closes in:</span>
                                    <span className="deadline-time">
                                        {hoursRemaining}h {minutesRemaining}m
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="dispute-form">
                            <div className="form-section">
                                <label className="form-label">Reason for Dispute</label>
                                <div className="reason-options">
                                    {DISPUTE_REASONS.map((reason) => (
                                        <button
                                            key={reason.id}
                                            className={`reason-option ${selectedReason === reason.id ? 'selected' : ''}`}
                                            onClick={() => {
                                                setSelectedReason(reason.id);
                                                hapticFeedback('light');
                                            }}
                                        >
                                            <span className="reason-label">{reason.label}</span>
                                            <span className="reason-description">{reason.description}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-section">
                                <label className="form-label" htmlFor="evidence">
                                    Evidence / Explanation
                                </label>
                                <textarea
                                    id="evidence"
                                    className="evidence-input"
                                    placeholder="Provide links to official weather sources, screenshots, or detailed explanation of the discrepancy..."
                                    value={evidence}
                                    onChange={(e) => setEvidence(e.target.value)}
                                    rows={4}
                                />
                            </div>

                            {error && (
                                <div className="dispute-error">
                                    {error}
                                </div>
                            )}

                            <div className="dispute-actions">
                                <button
                                    className="btn btn-secondary"
                                    onClick={handleClose}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-warning"
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || !address}
                                >
                                    {isSubmitting ? (
                                        <span className="loading-spinner small" />
                                    ) : (
                                        'Submit Dispute'
                                    )}
                                </button>
                            </div>

                            {!address && (
                                <p className="connect-warning">
                                    Connect your wallet to submit a dispute
                                </p>
                            )}
                        </div>

                        <div className="dispute-note">
                            <strong>Note:</strong> Frivolous disputes may result in reputation penalties.
                            Please only dispute if you have clear evidence of incorrect settlement.
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default DisputeModal;
