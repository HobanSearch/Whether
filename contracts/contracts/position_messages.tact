// ============================================
// POSITION TOKEN MESSAGES
// TEP-74 Compatible Jetton Messages for Position Tokens
// ============================================

// Standard Jetton Transfer (op: 0xf8a7ea5)
message(0xf8a7ea5) TokenTransfer {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;
    responseDestination: Address?;
    customPayload: Cell?;
    forwardTonAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

// Internal Transfer between wallets (op: 0x178d4519)
message(0x178d4519) TokenTransferInternal {
    queryId: Int as uint64;
    amount: Int as coins;
    from: Address;
    responseDestination: Address?;
    forwardTonAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

// Transfer notification to destination (op: 0x7362d09c)
message(0x7362d09c) TokenNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    from: Address;
    forwardPayload: Slice as remaining;
}

// Burn tokens (op: 0x595f07bc)
message(0x595f07bc) TokenBurn {
    queryId: Int as uint64;
    amount: Int as coins;
    responseDestination: Address?;
    customPayload: Cell?;
}

// Burn notification to minter (op: 0x7bdd97de)
message(0x7bdd97de) TokenBurnNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    sender: Address;
    responseDestination: Address?;
}

// Excess gas refund (op: 0xd53276db)
message(0xd53276db) TokenExcesses {
    queryId: Int as uint64;
}

// ============================================
// POSITION-SPECIFIC MESSAGES
// ============================================

// Mint position tokens (from PredictionMarket)
message MintPosition {
    queryId: Int as uint64;
    amount: Int as coins;
    recipient: Address;
    responseDestination: Address?;
}

// Redeem position tokens (after settlement)
message RedeemPosition {
    queryId: Int as uint64;
    amount: Int as coins;
}

// Set market as settled (from PredictionMarket)
message PositionSettled {
    queryId: Int as uint64;
    isWinningOutcome: Bool;
    totalPool: Int as coins;
    winningPool: Int as coins;
}

// ============================================
// RESPONSE STRUCTS
// ============================================

struct JettonData {
    totalSupply: Int;
    mintable: Bool;
    adminAddress: Address;
    content: Cell;
    walletCode: Cell;
}

struct JettonWalletData {
    balance: Int;
    ownerAddress: Address;
    masterAddress: Address;
    walletCode: Cell;
}
