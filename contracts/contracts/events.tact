// ============================================
// WHETHER SMART CONTRACT EVENTS
// Comprehensive event definitions for all contracts
// TON Foundation Presentation-Ready
// ============================================

// ============================================
// OPERATION CODES
// Standard op codes for efficient message handling
// ============================================

const OP_REFUND: Int = 0x00000001;
const OP_PAYOUT: Int = 0x00000002;
const OP_MINT_SUCCESS: Int = 0x00000003;
const OP_MINT_FAILED: Int = 0x00000004;
const OP_ORDER_FILLED: Int = 0x00000005;
const OP_ORDER_CANCELLED: Int = 0x00000006;
const OP_CLAIM_SUCCESS: Int = 0x7362d09c;
const OP_MINT_REFUND: Int = 0xbf9e5e3a;
const OP_DEPLOY_FAILED: Int = 0xdeadbeef;
const OP_EMERGENCY_WITHDRAW: Int = 0xdead0001;
const OP_EXCESS_REFUND: Int = 0x00000007;
const OP_EXPIRED_REFUND: Int = 0x00000008;
const OP_FEES_COLLECTED: Int = 0x00000009;

// ============================================
// MARKET EVENTS
// ============================================

message MarketCreatedEvent {
    marketId: Int as uint64;
    marketAddress: Address;
    creator: Address;
    eventDescription: String;
    locationId: Int as uint32;
    expiryTimestamp: Int as uint64;
}

message MarketResolvedEvent {
    marketId: Int as uint64;
    outcome: Bool;
    winningBracket: Int as uint8;
    settlementValue: Int as int32;
    timestamp: Int as uint64;
}

message BetPlacedEvent {
    marketId: Int as uint64;
    user: Address;
    side: Bool;
    bracketIndex: Int as uint8;
    amount: Int as coins;
    shares: Int as coins;
    timestamp: Int as uint64;
}

message PayoutClaimedEvent {
    marketId: Int as uint64;
    user: Address;
    grossPayout: Int as coins;
    fee: Int as coins;
    netPayout: Int as coins;
}

message MarketCancelledEvent {
    marketId: Int as uint64;
    reason: String;
    timestamp: Int as uint64;
}

message RefundProcessedEvent {
    marketId: Int as uint64;
    user: Address;
    amount: Int as coins;
}

// ============================================
// ORDER BOOK EVENTS
// ============================================

message OrderPlacedEvent {
    orderId: Int as uint64;
    owner: Address;
    side: Bool;
    price: Int as uint16;
    amount: Int as coins;
    marketAddress: Address;
}

message OrderMatchedEvent {
    takerOrderId: Int as uint64;
    makerOrderId: Int as uint64;
    amount: Int as coins;
    price: Int as uint16;
}

message OrderCancelledEvent {
    orderId: Int as uint64;
    remaining: Int as coins;
}

message OrderFilledEvent {
    orderId: Int as uint64;
    owner: Address;
    filledAmount: Int as coins;
    avgPrice: Int as uint16;
}

message OrderPartiallyFilledEvent {
    orderId: Int as uint64;
    filledAmount: Int as coins;
    remainingAmount: Int as coins;
}

message OrderExpiredEvent {
    orderId: Int as uint64;
    owner: Address;
    remaining: Int as coins;
}

message CancelAllRequestedEvent {
    user: Address;
}

message OrderBookSettledEvent {
    market: Address;
    winningOutcome: Bool;
    totalMatchedVolume: Int as coins;
    totalFeesCollected: Int as coins;
}

message OrderBookConfigUpdatedEvent {
    minOrderSize: Int as coins;
    maxOrdersPerUser: Int as uint8;
    makerFeeBps: Int as uint16;
    takerFeeBps: Int as uint16;
}

message MatchBounceEvent {
    takerOrderId: Int as uint64;
    makerOrderId: Int as uint64;
}

// ============================================
// DISPUTE EVENTS
// ============================================

message DisputeCreatedEvent {
    disputeId: Int as uint64;
    locationId: Int as uint32;
    date: Int as uint32;
    challenger: Address;
    bond: Int as coins;
    evidence: String;
}

message DisputeEscalatedEvent {
    disputeId: Int as uint64;
    locationId: Int as uint32;
    totalStake: Int as coins;
    additionalEvidence: String;
}

message DisputeResolvedEvent {
    disputeId: Int as uint64;
    upheld: Bool;
    resolvedBy: Address;
    newOutcome: Bool;
    newValue: Int as int32;
    reason: String;
}

message ArbitratorVotedEvent {
    disputeId: Int as uint64;
    arbitrator: Address;
    vote: Bool;
    weight: Int as uint8;
}

// ============================================
// EMERGENCY EVENTS
// ============================================

message EmergencyLevelChangedEvent {
    oldLevel: Int as uint8;
    newLevel: Int as uint8;
    reason: String;
    changedBy: Address;
    timestamp: Int as uint64;
}

message EmergencyWithdrawEvent {
    to: Address;
    amount: Int as coins;
    initiatedBy: Address;
    timestamp: Int as uint64;
}

message MarketPausedEvent {
    marketId: Int as uint64;
    paused: Bool;
    reason: String;
}

// ============================================
// TOKEN EVENTS
// ============================================

message MintEvent {
    to: Address;
    amount: Int as coins;
    side: Bool;
    marketId: Int as uint32;
}

message BurnEvent {
    from: Address;
    amount: Int as coins;
    payout: Int as coins;
}

message TransferEvent {
    from: Address;
    to: Address;
    amount: Int as coins;
}

// ============================================
// BOUNCE EVENTS
// ============================================

message MintBouncedEvent {
    user: Address;
    amount: Int as coins;
    side: Bool;
    refunded: Bool;
}

message ClaimBouncedEvent {
    user: Address;
    amount: Int as coins;
    pendingRetry: Bool;
}

message TransferBouncedEvent {
    from: Address;
    to: Address;
    amount: Int as coins;
    credited: Bool;
}

message DeploymentBouncedEvent {
    bouncedValue: Int as coins;
}

// ============================================
// GOVERNANCE EVENTS (Multi-sig & Proxy)
// ============================================

message TransactionSubmittedEvent {
    txId: Int as uint64;
    to: Address;
    value: Int as coins;
    submitter: Address;
    description: String;
}

message TransactionConfirmedEvent {
    txId: Int as uint64;
    confirmer: Address;
    confirmationCount: Int as uint8;
}

message TransactionExecutedEvent {
    txId: Int as uint64;
    executor: Address;
    success: Bool;
}

message ConfirmationRevokedEvent {
    txId: Int as uint64;
    revoker: Address;
}

message OwnerAddedEvent {
    owner: Address;
    addedBy: Address;
}

message OwnerRemovedEvent {
    owner: Address;
    removedBy: Address;
}

message RequirementChangedEvent {
    oldRequired: Int as uint8;
    newRequired: Int as uint8;
}

// ============================================
// PROXY/UPGRADE EVENTS
// ============================================

message UpgradeProposedEvent {
    upgradeId: Int as uint64;
    proposedBy: Address;
    description: String;
    timelockEnds: Int as uint64;
}

message UpgradeApprovedEvent {
    upgradeId: Int as uint64;
    approver: Address;
    approvalCount: Int as uint8;
}

message UpgradeExecutedEvent {
    upgradeId: Int as uint64;
    executor: Address;
    oldCodeHash: Int as uint256;
    newCodeHash: Int as uint256;
}

message UpgradeCancelledEvent {
    upgradeId: Int as uint64;
    cancelledBy: Address;
    reason: String;
}

message ApproverAddedEvent {
    approver: Address;
    addedBy: Address;
}

message ApproverRemovedEvent {
    approver: Address;
    removedBy: Address;
}

message ContractUpgradedEvent {
    oldStateHash: Int as uint256;
    newCodeHash: Int as uint256;
    version: Int as uint16;
}

// ============================================
// FACTORY EVENTS
// ============================================

message FactoryPausedEvent {
    paused: Bool;
    pausedBy: Address;
}

message MarketDeployedEvent {
    marketId: Int as uint64;
    marketAddress: Address;
    creator: Address;
    deploymentValue: Int as coins;
}

message MarketDeployFailedEvent {
    marketId: Int as uint64;
    creator: Address;
    refundAmount: Int as coins;
    reason: String;
}

message SeriesCreatedEvent {
    locationId: Int as uint32;
    startDate: Int as uint64;
    count: Int as uint8;
    intervalSeconds: Int as uint32;
}

// ============================================
// ORACLE EVENTS
// ============================================

message SettlementProposedEvent {
    marketId: Int as uint64;
    proposedValue: Int as int32;
    proposedBy: Address;
    timelockEnds: Int as uint64;
}

message SettlementFinalizedEvent {
    marketId: Int as uint64;
    finalValue: Int as int32;
    timestamp: Int as uint64;
}

message SettlementAmendedEvent {
    marketId: Int as uint64;
    oldValue: Int as int32;
    newValue: Int as int32;
    amendedBy: Address;
    reason: String;
}

// ============================================
// POSITION MINTER EVENTS
// ============================================

message PositionMintersInitializedEvent {
    marketId: Int as uint32;
    yesMinter: Address;
    noMinter: Address;
}

message PositionTokenSettledEvent {
    marketId: Int as uint32;
    outcome: Bool;
    isWinningOutcome: Bool;
    totalPool: Int as coins;
    winningPool: Int as coins;
}

message TokenRedemptionEvent {
    marketId: Int as uint32;
    recipient: Address;
    tokenAmount: Int as coins;
    grossPayout: Int as coins;
    fee: Int as coins;
    netPayout: Int as coins;
}

// ============================================
// STORAGE/GAS EVENTS
// ============================================

message StorageLimitReachedEvent {
    contractAddress: Address;
    limitType: String;
    currentCount: Int as uint32;
    maxCount: Int as uint32;
}

message GasRefundEvent {
    to: Address;
    amount: Int as coins;
    operation: String;
}
