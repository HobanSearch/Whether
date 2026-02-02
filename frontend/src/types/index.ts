// ============================================
// LOCATION TYPES
// ============================================

export type LocationType = 'airport' | 'city';
export type Region = 'North America' | 'Europe' | 'Asia' | 'Middle East' | 'South America' | 'Africa' | 'Oceania';

export interface Location {
    id: number;
    code: string;
    name: string;
    type: LocationType;
    coordinates: {
        lat: number;
        lon: number;
    };
    timezone: string;
    country: string;
    region: Region;
    icao?: string;
    isActive: boolean;
}

// Legacy LocationInfo for backward compatibility
export interface LocationInfo {
    id: string;
    name: string;
    fullName: string;
    lat: number;
    lon: number;
    timezone: string;
}

// ============================================
// MARKET TYPES
// ============================================

export type MarketType = 'binary' | 'bracket' | 'scalar';
export type MarketStatus = 'pending' | 'active' | 'expired' | 'resolving' | 'settled' | 'cancelled' | 'disputed';
export type ProductLine = 'airport' | 'urban' | 'precipitation' | 'extreme' | 'energy' | 'agricultural';
export type ResolutionType = 'temp_high' | 'temp_low' | 'precipitation' | 'visibility' | 'wind_speed' | 'conditions';
export type ComparisonType = 'gt' | 'lt' | 'eq' | 'gte' | 'lte';

export interface Bracket {
    id: string;
    marketId: string;
    index: number;
    lowerBound: number;
    upperBound: number;
    label: string;
    totalStaked: bigint;
}

export interface Market {
    id: string;
    marketId: number;
    address: string;
    title: string;
    question: string;
    description?: string;
    locationId: number;
    location: string;
    marketType: MarketType;
    productLine?: ProductLine;
    resolutionType: ResolutionType;
    threshold: number;
    comparisonType: ComparisonType;
    settlementTime: number;
    bettingEndsAt: number;
    status: MarketStatus;
    outcome?: 'YES' | 'NO';
    winningBracket?: number;
    observedValue?: number;
    yesPrice: number;
    noPrice: number;
    yesPool: bigint;
    noPool: bigint;
    totalCollateral: bigint;
    totalVolume: bigint;
    uniqueBettors: number;
    yesSupply: bigint;
    noSupply: bigint;
    createdAt: number;
    settledAt?: number;
    seriesId?: string;
    seriesIndex?: number;
    brackets?: Bracket[];
}

export interface MarketPrices {
    yesPrice: number;
    noPrice: number;
    yesReserve: bigint;
    noReserve: bigint;
    lpSupply: bigint;
}

export interface MarketSeries {
    id: string;
    name: string;
    description?: string;
    locationId: number;
    marketType: MarketType;
    resolutionType: ResolutionType;
    threshold: number;
    comparisonType: ComparisonType;
    intervalDays: number;
    isActive: boolean;
    marketsCreated: number;
}

// ============================================
// POSITION & TRADE TYPES
// ============================================

export type PositionStatus = 'open' | 'won' | 'lost' | 'claimed' | 'refunded';

export interface Position {
    id: string;
    marketId: string;
    market: Market;
    side?: boolean;
    bracketId?: string;
    yesBalance: bigint;
    noBalance: bigint;
    amount: bigint;
    avgYesPrice?: number;
    avgNoPrice?: number;
    averagePrice?: number;
    status: PositionStatus;
    unrealizedPnl?: number;
    payout?: bigint;
    createdAt: number;
    claimedAt?: number;
}

export interface TradeParams {
    marketId: string;
    side: 'YES' | 'NO';
    amount: bigint;
    minOutput: bigint;
}

export interface TradeResult {
    success: boolean;
    amountIn: bigint;
    amountOut: bigint;
    newYesPrice: number;
    newNoPrice: number;
    txHash?: string;
}

// ============================================
// USER TYPES
// ============================================

export type UserTier = 1 | 2 | 3 | 4;
export const USER_TIER_NAMES: Record<UserTier, string> = {
    1: 'Observer',
    2: 'Storm Chaser',
    3: 'Oracle',
    4: 'Council Member',
};

export interface UserStats {
    totalBets: number;
    totalWins: number;
    totalVolume: bigint;
    accuracyScore: number;
    winRate: number;
}

export interface User {
    id: string;
    telegramId: number;
    tonAddress?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    languageCode: string;
    tier: UserTier;
    stats: UserStats;
    squadId?: string;
    squad?: Squad;
    referralCode: string;
    referralEarnings: bigint;
    createdAt: number;
    lastActiveAt: number;
}

// ============================================
// SQUAD TYPES
// ============================================

export interface Squad {
    id: string;
    name: string;
    code: string;
    region: Region;
    memberCount: number;
    totalVolume: bigint;
    totalWins: number;
    totalAccuracy: number;
    weeklyRank?: number;
    allTimeRank?: number;
}

export interface SquadLeaderboard {
    squads: Squad[];
    period: 'weekly' | 'all_time';
    totalSquads: number;
}

// ============================================
// WEATHER TYPES
// ============================================

export type WeatherCondition =
    | 'clear'
    | 'partly_cloudy'
    | 'cloudy'
    | 'overcast'
    | 'fog'
    | 'drizzle'
    | 'rain'
    | 'heavy_rain'
    | 'snow'
    | 'thunderstorm';

export interface WeatherData {
    locationId: number;
    observationDate: string;
    temperature: number;
    temperatureMax: number;
    temperatureMin: number;
    precipitation: number;
    visibility: number;
    windSpeed: number;
    windDirection: number;
    windGust?: number;
    pressure: number;
    humidity: number;
    conditions: WeatherCondition;
    isFinalized: boolean;
}

export interface CurrentWeather {
    location: Location;
    data: WeatherData;
    updatedAt: string;
}

// ============================================
// FORECAST TYPES
// ============================================

export interface Forecast {
    location: string;
    locationId: number;
    date: string;
    pointForecast: {
        tMax: number;
        tMin: number;
    };
    distribution: {
        p10: number;
        p25: number;
        p50: number;
        p75: number;
        p90: number;
    };
    confidence: {
        ci68: [number, number];
        ci95: [number, number];
    };
    generatedAt: string;
}

// ============================================
// INSURANCE TYPES
// ============================================

export type PolicyStatus = 'active' | 'triggered' | 'expired' | 'claimed';
export type ProductType = 'temp_extreme' | 'precipitation' | 'hurricane';
export type TriggerComparison = 'above' | 'below';

export interface InsurancePolicy {
    id: string;
    holder: string;
    productType: ProductType;
    location: string;
    locationId: number;
    triggerThreshold: number;
    triggerComparison: TriggerComparison;
    coverageAmount: bigint;
    premium: bigint;
    coverageStartTime: number;
    coverageEndTime: number;
    status: PolicyStatus;
    triggeredAt?: number;
    observedValue?: number;
}

export interface PurchasePolicyParams {
    productType: ProductType;
    location: string;
    threshold: number;
    comparison: TriggerComparison;
    coverageAmount: bigint;
    startTime: number;
    endTime: number;
}

export interface InsuranceQuote {
    premium: bigint;
    baseRate: number;
    basisRiskAdjustment: number;
    loadFactor: number;
    effectivePremiumRate: number;
}

export interface CapitalPool {
    totalCapital: bigint;
    lockedCapital: bigint;
    availableCapital: bigint;
    utilizationRate: number;
}

// ============================================
// TRANSACTION TYPES
// ============================================

export type TransactionType = 'bet' | 'claim' | 'refund' | 'deposit' | 'withdraw' | 'referral_bonus' | 'airdrop';
export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

export interface Transaction {
    id: string;
    userId: string;
    type: TransactionType;
    amount: bigint;
    currency: string;
    marketId?: string;
    positionId?: string;
    txHash?: string;
    status: TransactionStatus;
    createdAt: number;
    confirmedAt?: number;
}

// ============================================
// TON CONNECT TRADING TYPES
// ============================================

export type TransactionPhase =
    | 'idle'
    | 'preparing'
    | 'awaiting_signature'
    | 'confirming'
    | 'confirmed'
    | 'failed';

export interface PreparedTransaction {
    to: string;
    value: string;
    payload: string;
    stateInit?: string;
}

export interface TradeEstimate {
    inputAmount: string;
    outputTokens: string;
    minOutput: string;
    priceImpact: number;
    effectivePrice: number;
    yesPriceAfter: number;
    noPriceAfter: number;
}

export interface PrepareBetRequest {
    side: 'YES' | 'NO';
    amount: string;
    slippage?: number;
    bracketIndex?: number;
}

export interface PrepareBetResponse {
    transaction: PreparedTransaction;
    estimate: TradeEstimate;
}

export interface PrepareClaimRequest {
    userAddress: string;
}

export interface ClaimEstimate {
    claimable: boolean;
    payoutAmount: string;
    winningSide?: 'yes' | 'no';
    reason?: string;
}

export interface PrepareClaimResponse {
    transaction?: PreparedTransaction;
    estimate: ClaimEstimate;
}

export interface PrepareRefundRequest {
    userAddress: string;
}

export interface PrepareRefundResponse {
    transaction?: PreparedTransaction;
    refundAmount: string;
}

export interface MarketOdds {
    yesPct: number;
    noPct: number;
    lastUpdated: number;
}

export interface UserMarketPosition {
    marketId: string;
    market: Market;
    yesBalance: string;
    noBalance: string;
    avgYesPrice?: number;
    avgNoPrice?: number;
    unrealizedPnl?: number;
}

export interface SettlementStatus {
    marketAddress: string;
    status: 'pending' | 'awaiting_data' | 'dispute_period' | 'ready_to_resolve' | 'resolved' | 'claimable';
    expiryTimestamp: number;
    weatherFinalized: boolean;
    weatherData?: {
        temperature: number;
        temperatureMax: number;
        temperatureMin: number;
        precipitation: number;
        visibility: number;
        windSpeed: number;
        conditions: number;
        timestamp: number;
        isFinalized: boolean;
    };
    disputeWindowEnds?: number;
    canClaim: boolean;
    outcome?: 'yes' | 'no';
    settlementValue?: number;
    nextAction?: string;
}

export interface TransactionConfirmation {
    hash: string;
    status: 'pending' | 'confirmed' | 'failed';
    lt?: number;
    utime?: number;
    exitCode?: number;
}

// ============================================
// LEGACY LOCATIONS (backward compatibility)
// ============================================

export const LOCATIONS: Record<string, LocationInfo> = {
    KNYC: {
        id: 'KNYC',
        name: 'New York',
        fullName: 'New York City, NY',
        lat: 40.7128,
        lon: -74.006,
        timezone: 'America/New_York',
    },
    KORD: {
        id: 'KORD',
        name: 'Chicago',
        fullName: "Chicago O'Hare, IL",
        lat: 41.9742,
        lon: -87.9073,
        timezone: 'America/Chicago',
    },
    KMIA: {
        id: 'KMIA',
        name: 'Miami',
        fullName: 'Miami, FL',
        lat: 25.7959,
        lon: -80.287,
        timezone: 'America/New_York',
    },
    KAUS: {
        id: 'KAUS',
        name: 'Austin',
        fullName: 'Austin, TX',
        lat: 30.1944,
        lon: -97.67,
        timezone: 'America/Chicago',
    },
};

// ============================================
// ACHIEVEMENT TYPES
// ============================================

export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type AchievementCategory = 'betting' | 'streaks' | 'volume' | 'social' | 'special';

export const RARITY_COLORS: Record<AchievementRarity, string> = {
    common: '#6B7280',
    uncommon: '#10B981',
    rare: '#3B82F6',
    epic: '#8B5CF6',
    legendary: '#F97316',
};

export const RARITY_LABELS: Record<AchievementRarity, string> = {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary',
};

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: AchievementCategory;
    rarity: AchievementRarity;
    pointsReward: number;
    badgeColor?: string;
    isUnlocked: boolean;
    unlockedAt?: string;
    progress: number;
    target: number;
    progressPct: number;
}

export interface AchievementStats {
    totalAchievements: number;
    unlockedCount: number;
    completionPct: number;
    pointsEarned: number;
    rarityBreakdown: Record<string, number>;
}

// ============================================
// STREAK TYPES
// ============================================

export interface StreakInfo {
    currentStreak: number;
    bestStreak: number;
    multiplier: number;
    nextMilestone?: number;
    nextMilestoneMultiplier?: number;
    isActive: boolean;
    lastWinAt?: string;
    streakUpdatedAt?: string;
}

export const STREAK_MULTIPLIERS: Record<number, number> = {
    0: 1.0,
    3: 1.1,
    5: 1.25,
    10: 1.5,
    15: 1.75,
    20: 2.0,
};

// ============================================
// POINTS TYPES
// ============================================

export type PointSource =
    | 'bet_placed'
    | 'bet_won'
    | 'streak_bonus'
    | 'daily_login'
    | 'referral_signup'
    | 'referral_bet'
    | 'achievement_unlock'
    | 'squad_bonus';

export const POINT_SOURCE_LABELS: Record<PointSource, string> = {
    bet_placed: 'Bet Placed',
    bet_won: 'Bet Won',
    streak_bonus: 'Streak Bonus',
    daily_login: 'Daily Login',
    referral_signup: 'Referral Signup',
    referral_bet: 'Referral Bet',
    achievement_unlock: 'Achievement',
    squad_bonus: 'Squad Bonus',
};

export interface PointsBreakdown {
    bets: number;
    wins: number;
    streaks: number;
    referrals: number;
    achievements: number;
    daily: number;
}

export interface PointsInfo {
    balance: number;
    totalEarned: number;
    totalSpent: number;
    earnedBreakdown: PointsBreakdown;
    loginStreak: number;
    bestLoginStreak: number;
    dailyLoginAvailable: boolean;
    tierMultiplier: number;
}

export interface PointsHistoryEntry {
    id: string;
    amount: number;
    source: PointSource;
    description?: string;
    balanceAfter: number;
    streakMultiplier?: number;
    tierMultiplier?: number;
    createdAt: string;
}

// ============================================
// ENGAGEMENT SUMMARY
// ============================================

export interface EngagementSummary {
    streak: StreakInfo;
    points: PointsInfo;
    achievements: {
        stats: AchievementStats;
        recent: Achievement[];
    };
}

// ============================================
// LEADERBOARD TYPES
// ============================================

export interface StreakLeaderboardEntry {
    rank: number;
    userId: string;
    username?: string;
    firstName?: string;
    currentStreak: number;
    bestStreak: number;
    multiplier: number;
    tier: UserTier;
}

export interface PointsLeaderboardEntry {
    rank: number;
    userId: string;
    username?: string;
    firstName?: string;
    balance: number;
    totalEarned: number;
    tier: UserTier;
}

export interface DailyLoginResult {
    success: boolean;
    baseAmount?: number;
    streakBonus?: number;
    totalAwarded?: number;
    loginStreak?: number;
    bestLoginStreak?: number;
    newBalance?: number;
    error?: string;
    nextAvailableAt?: string;
}

// Generic leaderboard entry for UI display
export interface LeaderboardEntry {
    rank: number;
    userId: string;
    displayName: string;
    avatarUrl?: string;
    value: number;
}

// ============================================
// PRODUCT LINE & FEATURED MARKET TYPES
// ============================================

export interface ProductLineConfig {
    id: ProductLine;
    name: string;
    nameKey: string;
    icon: string;
    color: string;
    shadowVar: string;
}

export const PRODUCT_LINE_CONFIGS: ProductLineConfig[] = [
    { id: 'airport', name: 'Flight Watch', nameKey: 'productLines.airport', icon: '/assets/weather/wind.png', color: 'var(--color-airport)', shadowVar: 'var(--shadow-airport)' },
    { id: 'urban', name: 'City Heat', nameKey: 'productLines.urban', icon: '/assets/weather/clear.png', color: 'var(--color-urban)', shadowVar: 'var(--shadow-urban)' },
    { id: 'precipitation', name: 'Rain Check', nameKey: 'productLines.precipitation', icon: '/assets/weather/rain.png', color: 'var(--color-precipitation)', shadowVar: 'var(--shadow-precipitation)' },
    { id: 'extreme', name: 'Storm Chasers', nameKey: 'productLines.extreme', icon: '/assets/weather/storm.png', color: 'var(--color-extreme)', shadowVar: 'var(--shadow-extreme)' },
    { id: 'energy', name: 'Power Grid', nameKey: 'productLines.energy', icon: '/assets/weather/lightning.png', color: 'var(--color-energy)', shadowVar: 'var(--shadow-energy)' },
    { id: 'agricultural', name: 'Harvest Outlook', nameKey: 'productLines.agricultural', icon: '/assets/weather/clear.png', color: 'var(--color-agricultural)', shadowVar: 'var(--shadow-agricultural)' },
];

export type FeaturedReason = 'hot' | 'closing_soon' | 'high_volume' | 'trending' | 'new';

export interface FeaturedMarket extends Market {
    featuredReason?: FeaturedReason;
    featuredScore?: number;
}

export interface MarketTypeConfig {
    type: MarketType;
    label: string;
    labelKey: string;
    icon: string;
    color: string;
    shadowVar: string;
}

export const MARKET_TYPE_CONFIGS: MarketTypeConfig[] = [
    { type: 'binary', label: 'Yes/No', labelKey: 'markets.marketTypes.binary', icon: '/assets/weather/lightning.png', color: 'var(--color-binary)', shadowVar: 'var(--shadow-binary)' },
    { type: 'bracket', label: 'Bracket', labelKey: 'markets.marketTypes.bracket', icon: '/assets/weather/chart.png', color: 'var(--color-bracket)', shadowVar: 'var(--shadow-bracket)' },
    { type: 'scalar', label: 'Range', labelKey: 'markets.marketTypes.scalar', icon: '/assets/weather/chart.png', color: 'var(--color-scalar)', shadowVar: 'var(--shadow-scalar)' },
];

export function getMarketTypeConfig(type: MarketType): MarketTypeConfig {
    return MARKET_TYPE_CONFIGS.find(c => c.type === type) || MARKET_TYPE_CONFIGS[0];
}

export function getProductLineConfig(line: ProductLine): ProductLineConfig | undefined {
    return PRODUCT_LINE_CONFIGS.find(c => c.id === line);
}

// ============================================
// AGENT TYPES
// ============================================

export type AgentStatus = 'pending' | 'active' | 'paused' | 'stopped';
export type AgentPositionStatus = 'pending' | 'open' | 'closed' | 'cancelled';
export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'very_high';
export type PositionDirection = 'YES' | 'NO';

export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
    pending: 'Pending',
    active: 'Active',
    paused: 'Paused',
    stopped: 'Stopped',
};

export const AGENT_STATUS_COLORS: Record<AgentStatus, string> = {
    pending: '#F59E0B',
    active: '#10B981',
    paused: '#6B7280',
    stopped: '#EF4444',
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    very_high: 'Very High',
};

export const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
    low: '#6B7280',
    medium: '#F59E0B',
    high: '#10B981',
    very_high: '#8B5CF6',
};

export interface MarketSelectionConfig {
    types: string[];
    locations: string[];
    timeHorizon: string[];
}

export interface EntryConditionConfig {
    field: string;
    operator: string;
    value: number | string;
}

export interface PositionSizingConfig {
    baseSize: number;
    scalingRule: 'fixed' | 'confidence_scaled' | 'edge_scaled' | 'kelly';
    maxPosition?: number;
}

export interface RiskControlsConfig {
    minConfidence: ConfidenceLevel;
    minEdge: number;
    maxPositionSize: number;
    maxDailyTrades: number;
    maxDailyLoss?: number;
    maxPositions?: number;
}

export type EntryCondition = EntryConditionConfig;

export type AgentRankTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface AgentRank {
    agentId: string;
    rank: number;
    totalAgents: number;
    percentile: number;
    score: number;
    period: string;
}

export interface StrategyConfig {
    strategyName: string;
    thesis: string;
    marketSelection: MarketSelectionConfig;
    entryConditions: EntryConditionConfig[];
    positionDirection: PositionDirection | 'dynamic';
    positionSizing: PositionSizingConfig;
    riskControls: RiskControlsConfig;
}

export interface Agent {
    id: string;
    userId: string;
    telegramChatId: number;
    strategyName: string;
    strategyConfig: StrategyConfig;
    status: AgentStatus;
    totalTrades: number;
    winningTrades: number;
    losingTrades?: number;
    winRate: number;
    totalPnl: string;
    predictionAccuracy?: number;
    avgConfidence?: number;
    createdAt: number;
    updatedAt: number;
}

export interface AgentPosition {
    id: string;
    agentId: string;
    marketId: string;
    marketQuestion?: string;
    predictionId?: string;
    direction: PositionDirection;
    amount: string;
    entryPrice: string;
    exitPrice?: string;
    pnl?: string;
    status: AgentPositionStatus;
    createdAt: number;
    closedAt?: number;
}

export interface AgentPrediction {
    id: string;
    agentId: string;
    marketId: string;
    marketQuestion?: string;
    predictedProbability: number;
    marketProbability: number;
    confidence: ConfidenceLevel;
    edge: number;
    reasoning: string;
    weatherFactors: string[];
    recommendedDirection: PositionDirection;
    recommendedSize?: number;
    wasCorrect?: boolean;
    actualOutcome?: string;
    createdAt: number;
}

export interface AgentLeaderboardEntry {
    rank: number;
    agentId: string;
    strategyName: string;
    userId: string;
    ownerUsername?: string;
    totalTrades: number;
    winRate: number;
    totalPnl: string;
    score: number;
}

export interface CreateAgentParams {
    telegramChatId: number;
    strategyName: string;
    strategyConfig: StrategyConfig;
}

export interface UpdateAgentParams {
    status?: AgentStatus;
    strategyConfig?: StrategyConfig;
}

export interface CreateAgentPositionParams {
    marketId: string;
    direction: PositionDirection;
    amount: string;
}

// ============================================
// LIQUIDITY POOL TYPES
// ============================================

export interface PoolStatsResponse {
    tvl: string;
    tvl_formatted: string;
    total_shares: string;
    share_price: string;
    accrued_fees: string;
    total_fees_collected: string;
    lp_count: number;
    apy: number;
    apy_7d: number;
    apy_30d: number;
}

export interface LPPositionResponse {
    wallet_address: string;
    shares: string;
    shares_formatted: string;
    deposited_value: string;
    deposited_formatted: string;
    current_value: string;
    current_value_formatted: string;
    earnings: string;
    earnings_formatted: string;
    share_of_pool: number;
}

export interface PreparedLPTransaction {
    to: string;
    value: string;
    payload: string;
    state_init?: string;
}

export interface DepositEstimateResponse {
    input_amount: string;
    shares_to_receive: string;
    share_price: string;
    share_of_pool_after: number;
}

export interface WithdrawEstimateResponse {
    shares_to_burn: string;
    amount_to_receive: string;
    fee: string;
    net_amount: string;
    share_price: string;
}

export interface PrepareDepositResponse {
    transaction: PreparedLPTransaction;
    estimate: DepositEstimateResponse;
}

export interface PrepareWithdrawResponse {
    transaction: PreparedLPTransaction;
    estimate: WithdrawEstimateResponse;
}

export interface LPTransactionResponse {
    id: string;
    tx_type: 'deposit' | 'withdraw' | 'fee_claim';
    amount: string;
    shares?: string;
    share_price?: string;
    tx_hash?: string;
    created_at: string;
}

export interface APYHistoryEntry {
    date: string;
    apy: number;
    tvl: string;
}

export interface APYHistoryResponse {
    history: APYHistoryEntry[];
}
