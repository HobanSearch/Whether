import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateAgent } from '../hooks';
import { useTelegramApp } from '../hooks/useTelegramApp';
import type { StrategyConfig, ConfidenceLevel, EntryCondition } from '../types';
import './CreateAgentPage.css';

const MARKET_TYPES = ['temperature', 'precipitation', 'visibility', 'wind'];
const LOCATIONS = ['NYC', 'CHI', 'MIA', 'AUS', 'LAX', 'SEA', 'DEN', 'BOS'];
const TIME_HORIZONS = ['1d', '2d', '3d', '5d', '7d'];
const CONFIDENCE_LEVELS: ConfidenceLevel[] = ['low', 'medium', 'high', 'very_high'];
const CONDITION_FIELDS = ['probability', 'edge', 'volume', 'time_to_expiry'];
const CONDITION_OPERATORS = ['>', '<', '>=', '<=', '=='];

function CreateAgentPage() {
    const { user } = useTelegramApp();
    const navigate = useNavigate();
    const createAgent = useCreateAgent();

    const [step, setStep] = useState(1);
    const [strategyName, setStrategyName] = useState('');
    const [thesis, setThesis] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<string[]>(['temperature']);
    const [selectedLocations, setSelectedLocations] = useState<string[]>(['NYC']);
    const [selectedTimeHorizons, setSelectedTimeHorizons] = useState<string[]>(['1d', '2d']);
    const [positionDirection, setPositionDirection] = useState<'YES' | 'NO' | 'dynamic'>('dynamic');
    const [baseSize, setBaseSize] = useState('0.05');
    const [scalingRule, setScalingRule] = useState<'fixed' | 'kelly' | 'confidence_scaled'>('fixed');
    const [maxPosition, setMaxPosition] = useState('0.5');
    const [minConfidence, setMinConfidence] = useState<ConfidenceLevel>('medium');
    const [minEdge, setMinEdge] = useState('0.05');
    const [maxDailyLoss, setMaxDailyLoss] = useState('1.0');
    const [maxPositions, setMaxPositions] = useState('10');
    const [entryConditions, setEntryConditions] = useState<EntryCondition[]>([
        { field: 'edge', operator: '>', value: 0.05 },
    ]);

    const toggleArrayItem = <T extends string>(arr: T[], item: T, setter: (arr: T[]) => void) => {
        if (arr.includes(item)) {
            setter(arr.filter((i) => i !== item));
        } else {
            setter([...arr, item]);
        }
    };

    const addCondition = () => {
        setEntryConditions([...entryConditions, { field: 'probability', operator: '>', value: 0.5 }]);
    };

    const removeCondition = (index: number) => {
        setEntryConditions(entryConditions.filter((_, i) => i !== index));
    };

    const updateCondition = (index: number, updates: Partial<EntryCondition>) => {
        setEntryConditions(
            entryConditions.map((c, i) => (i === index ? { ...c, ...updates } : c))
        );
    };

    const handleSubmit = async () => {
        if (!user?.id) {
            alert('Please open this app from Telegram');
            return;
        }

        const config: StrategyConfig = {
            strategyName,
            thesis,
            marketSelection: {
                types: selectedTypes,
                locations: selectedLocations,
                timeHorizon: selectedTimeHorizons,
            },
            entryConditions,
            positionDirection,
            positionSizing: {
                baseSize: parseFloat(baseSize),
                scalingRule,
                maxPosition: parseFloat(maxPosition),
            },
            riskControls: {
                minConfidence,
                minEdge: parseFloat(minEdge),
                maxPositionSize: parseFloat(maxPosition),
                maxDailyTrades: parseInt(maxPositions),
                maxDailyLoss: parseFloat(maxDailyLoss),
                maxPositions: parseInt(maxPositions),
            },
        };

        try {
            const agent = await createAgent.mutateAsync({
                telegramChatId: user.id,
                strategyName,
                strategyConfig: config,
            });
            navigate(`/agents/${agent.id}`);
        } catch (error) {
            console.error('Failed to create agent:', error);
            alert('Failed to create agent. Please try again.');
        }
    };

    const canProceed = () => {
        switch (step) {
            case 1:
                return strategyName.trim().length > 0 && thesis.trim().length > 0;
            case 2:
                return selectedTypes.length > 0 && selectedLocations.length > 0;
            case 3:
                return entryConditions.length > 0;
            case 4:
                return true;
            default:
                return false;
        }
    };

    const renderStep1 = () => (
        <div className="step-content">
            <h2>Strategy Basics</h2>
            <p className="step-description text-hint">
                Give your agent a name and describe your trading thesis.
            </p>

            <div className="form-group">
                <label>Strategy Name</label>
                <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., NYC Temperature Contrarian"
                    value={strategyName}
                    onChange={(e) => setStrategyName(e.target.value)}
                    maxLength={50}
                />
            </div>

            <div className="form-group">
                <label>Investment Thesis</label>
                <textarea
                    className="form-textarea"
                    placeholder="Describe your strategy in natural language. e.g., 'I believe NWS temperature forecasts consistently overestimate highs during winter months in NYC...'"
                    value={thesis}
                    onChange={(e) => setThesis(e.target.value)}
                    rows={4}
                    maxLength={500}
                />
                <span className="char-count">{thesis.length}/500</span>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="step-content">
            <h2>Market Selection</h2>
            <p className="step-description text-hint">
                Choose which markets your agent will analyze and trade.
            </p>

            <div className="form-group">
                <label>Market Types</label>
                <div className="chip-grid">
                    {MARKET_TYPES.map((type) => (
                        <button
                            key={type}
                            className={`chip ${selectedTypes.includes(type) ? 'active' : ''}`}
                            onClick={() => toggleArrayItem(selectedTypes, type, setSelectedTypes)}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            <div className="form-group">
                <label>Locations</label>
                <div className="chip-grid">
                    {LOCATIONS.map((loc) => (
                        <button
                            key={loc}
                            className={`chip ${selectedLocations.includes(loc) ? 'active' : ''}`}
                            onClick={() => toggleArrayItem(selectedLocations, loc, setSelectedLocations)}
                        >
                            {loc}
                        </button>
                    ))}
                </div>
            </div>

            <div className="form-group">
                <label>Time Horizons</label>
                <div className="chip-grid">
                    {TIME_HORIZONS.map((h) => (
                        <button
                            key={h}
                            className={`chip ${selectedTimeHorizons.includes(h) ? 'active' : ''}`}
                            onClick={() => toggleArrayItem(selectedTimeHorizons, h, setSelectedTimeHorizons)}
                        >
                            {h}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="step-content">
            <h2>Entry Conditions</h2>
            <p className="step-description text-hint">
                Define when your agent should enter positions.
            </p>

            <div className="form-group">
                <label>Position Direction</label>
                <div className="radio-group">
                    <label className="radio-option">
                        <input
                            type="radio"
                            name="direction"
                            value="dynamic"
                            checked={positionDirection === 'dynamic'}
                            onChange={() => setPositionDirection('dynamic')}
                        />
                        <span>Dynamic (AI decides)</span>
                    </label>
                    <label className="radio-option">
                        <input
                            type="radio"
                            name="direction"
                            value="YES"
                            checked={positionDirection === 'YES'}
                            onChange={() => setPositionDirection('YES')}
                        />
                        <span>Always YES</span>
                    </label>
                    <label className="radio-option">
                        <input
                            type="radio"
                            name="direction"
                            value="NO"
                            checked={positionDirection === 'NO'}
                            onChange={() => setPositionDirection('NO')}
                        />
                        <span>Always NO</span>
                    </label>
                </div>
            </div>

            <div className="form-group">
                <label>Entry Conditions</label>
                <div className="conditions-list">
                    {entryConditions.map((condition, index) => (
                        <div key={index} className="condition-row">
                            <select
                                className="condition-select"
                                value={condition.field}
                                onChange={(e) => updateCondition(index, { field: e.target.value })}
                            >
                                {CONDITION_FIELDS.map((f) => (
                                    <option key={f} value={f}>{f}</option>
                                ))}
                            </select>
                            <select
                                className="condition-select small"
                                value={condition.operator}
                                onChange={(e) => updateCondition(index, { operator: e.target.value })}
                            >
                                {CONDITION_OPERATORS.map((op) => (
                                    <option key={op} value={op}>{op}</option>
                                ))}
                            </select>
                            <input
                                type="number"
                                className="condition-input"
                                value={condition.value}
                                onChange={(e) => updateCondition(index, { value: parseFloat(e.target.value) })}
                                step="0.01"
                            />
                            <button
                                className="btn-icon remove-btn"
                                onClick={() => removeCondition(index)}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
                <button className="btn btn-secondary add-condition-btn" onClick={addCondition}>
                    + Add Condition
                </button>
            </div>
        </div>
    );

    const renderStep4 = () => (
        <div className="step-content">
            <h2>Risk Management</h2>
            <p className="step-description text-hint">
                Configure position sizing and risk controls.
            </p>

            <div className="form-row">
                <div className="form-group half">
                    <label>Base Position Size (TON)</label>
                    <input
                        type="number"
                        className="form-input"
                        value={baseSize}
                        onChange={(e) => setBaseSize(e.target.value)}
                        min="0.01"
                        step="0.01"
                    />
                </div>
                <div className="form-group half">
                    <label>Max Position (TON)</label>
                    <input
                        type="number"
                        className="form-input"
                        value={maxPosition}
                        onChange={(e) => setMaxPosition(e.target.value)}
                        min="0.1"
                        step="0.1"
                    />
                </div>
            </div>

            <div className="form-group">
                <label>Scaling Rule</label>
                <select
                    className="form-select"
                    value={scalingRule}
                    onChange={(e) => setScalingRule(e.target.value as any)}
                >
                    <option value="fixed">Fixed Size</option>
                    <option value="kelly">Kelly Criterion</option>
                    <option value="confidence_scaled">Confidence Scaled</option>
                </select>
            </div>

            <div className="form-row">
                <div className="form-group half">
                    <label>Min Confidence</label>
                    <select
                        className="form-select"
                        value={minConfidence}
                        onChange={(e) => setMinConfidence(e.target.value as ConfidenceLevel)}
                    >
                        {CONFIDENCE_LEVELS.map((level) => (
                            <option key={level} value={level}>{level.replace('_', ' ')}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group half">
                    <label>Min Edge (%)</label>
                    <input
                        type="number"
                        className="form-input"
                        value={(parseFloat(minEdge) * 100).toFixed(0)}
                        onChange={(e) => setMinEdge((parseFloat(e.target.value) / 100).toString())}
                        min="1"
                        max="50"
                        step="1"
                    />
                </div>
            </div>

            <div className="form-row">
                <div className="form-group half">
                    <label>Max Daily Loss (TON)</label>
                    <input
                        type="number"
                        className="form-input"
                        value={maxDailyLoss}
                        onChange={(e) => setMaxDailyLoss(e.target.value)}
                        min="0.1"
                        step="0.1"
                    />
                </div>
                <div className="form-group half">
                    <label>Max Open Positions</label>
                    <input
                        type="number"
                        className="form-input"
                        value={maxPositions}
                        onChange={(e) => setMaxPositions(e.target.value)}
                        min="1"
                        max="50"
                        step="1"
                    />
                </div>
            </div>
        </div>
    );

    const renderReview = () => (
        <div className="step-content">
            <h2>Review & Deploy</h2>
            <p className="step-description text-hint">
                Review your agent configuration before deploying.
            </p>

            <div className="review-section glass-panel">
                <h3>{strategyName}</h3>
                <p className="thesis-text">{thesis}</p>

                <div className="review-grid">
                    <div className="review-item">
                        <span className="review-label">Market Types</span>
                        <span className="review-value">{selectedTypes.join(', ')}</span>
                    </div>
                    <div className="review-item">
                        <span className="review-label">Locations</span>
                        <span className="review-value">{selectedLocations.join(', ')}</span>
                    </div>
                    <div className="review-item">
                        <span className="review-label">Time Horizons</span>
                        <span className="review-value">{selectedTimeHorizons.join(', ')}</span>
                    </div>
                    <div className="review-item">
                        <span className="review-label">Direction</span>
                        <span className="review-value">{positionDirection}</span>
                    </div>
                    <div className="review-item">
                        <span className="review-label">Position Size</span>
                        <span className="review-value">{baseSize} - {maxPosition} TON</span>
                    </div>
                    <div className="review-item">
                        <span className="review-label">Min Confidence</span>
                        <span className="review-value">{minConfidence}</span>
                    </div>
                    <div className="review-item">
                        <span className="review-label">Min Edge</span>
                        <span className="review-value">{(parseFloat(minEdge) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="review-item">
                        <span className="review-label">Entry Conditions</span>
                        <span className="review-value">{entryConditions.length} rule(s)</span>
                    </div>
                </div>
            </div>

            <div className="deploy-notice glass-panel">
                <p>
                    Your agent will start analyzing markets immediately after deployment.
                    You can pause or stop it at any time from the agent dashboard.
                </p>
            </div>
        </div>
    );

    return (
        <div className="container create-agent-page">
            <header className="page-header">
                <button className="back-btn" onClick={() => navigate('/agents')}>
                    ← Back
                </button>
                <h1 className="page-title">Create AI Agent</h1>
            </header>

            <div className="progress-bar">
                {[1, 2, 3, 4, 5].map((s) => (
                    <div
                        key={s}
                        className={`progress-step ${s <= step ? 'active' : ''} ${s < step ? 'completed' : ''}`}
                    >
                        {s < step ? '✓' : s}
                    </div>
                ))}
            </div>

            <div className="step-container glass-panel">
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
                {step === 5 && renderReview()}
            </div>

            <div className="nav-buttons">
                {step > 1 && (
                    <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>
                        Back
                    </button>
                )}
                {step < 5 ? (
                    <button
                        className="btn btn-primary"
                        onClick={() => setStep(step + 1)}
                        disabled={!canProceed()}
                    >
                        Continue
                    </button>
                ) : (
                    <button
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={createAgent.isPending}
                    >
                        {createAgent.isPending ? 'Deploying...' : 'Deploy Agent'}
                    </button>
                )}
            </div>
        </div>
    );
}

export default CreateAgentPage;
