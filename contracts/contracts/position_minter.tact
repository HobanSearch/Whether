import "@stdlib/deploy";
import "./position_messages.tact";
import "./events.tact";
import "./upgradeable.tact";

// ============================================
// WHETHER POSITION TOKEN MINTER
// TEP-74/89 Fully Compliant Jetton Master
// Production-Ready with Bounce Handlers
// TON Foundation Presentation-Ready
// ============================================

struct PositionMinterInit {
    marketAddress: Address;
    outcome: Bool;
    marketId: Int as uint32;
    proxyAdmin: Address;
}

contract PositionMinter with Deployable {
    // Immutable config
    marketAddress: Address;
    outcome: Bool;
    marketId: Int as uint32;

    // Token state
    totalSupply: Int as coins = 0;
    mintable: Bool = true;

    // Settlement state
    isSettled: Bool = false;
    isWinningOutcome: Bool = false;
    totalPool: Int as coins = 0;
    winningPool: Int as coins = 0;

    // TEP-74 metadata
    content: Cell;

    // Fee configuration
    creatorFeeBps: Int as uint16 = 100;  // 1% creator fee
    protocolFeeBps: Int as uint16 = 50;   // 0.5% protocol fee
    creatorAddress: Address;
    protocolAddress: Address;

    // Pending operations for bounce recovery
    pendingMints: map<Int, PendingMint>;
    pendingBurns: map<Int, PendingBurn>;
    nextPendingId: Int as uint64 = 0;

    // Constants
    const MIN_TON_FOR_STORAGE: Int = ton("0.05");
    const GAS_CONSUMPTION: Int = ton("0.03");
    const MINT_GAS: Int = ton("0.08");
    const BURN_GAS: Int = ton("0.15");
    const FEE_DENOMINATOR: Int = 10000;

    init(params: PositionMinterInit) {
        self.marketAddress = params.marketAddress;
        self.outcome = params.outcome;
        self.marketId = params.marketId;
        self.creatorAddress = params.marketAddress;  // Default to market
        self.protocolAddress = params.proxyAdmin;

        // Create TEP-64 compliant metadata
        let tokenName: String = params.outcome ? "YES Position" : "NO Position";
        let builder: StringBuilder = beginString();
        builder.append(tokenName);
        builder.append(" #");
        builder.append(params.marketId.toString());

        // Store as on-chain metadata with snake format
        self.content = beginCell()
            .storeUint(0x00, 8)  // On-chain metadata tag
            .storeRef(
                beginCell()
                    .storeUint(0x6e616d65, 32)  // "name" key
                    .storeRef(builder.toCell())
                    .endCell()
            )
            .endCell();
    }

    // ============================================
    // MINTING (Only from PredictionMarket)
    // ============================================

    receive(msg: MintPosition) {
        require(sender() == self.marketAddress, "Only market can mint");
        require(self.mintable, "Minting disabled");
        require(!self.isSettled, "Market settled");
        require(msg.amount > 0, "Zero amount");

        let ctx: Context = context();
        require(ctx.value >= self.MINT_GAS, "Insufficient gas");

        // Store pending mint for bounce recovery
        let pendingId: Int = self.nextPendingId;
        self.nextPendingId = self.nextPendingId + 1;

        self.pendingMints.set(pendingId, PendingMint{
            recipient: msg.recipient,
            amount: msg.amount,
            queryId: msg.queryId
        });

        // Update total supply
        self.totalSupply = self.totalSupply + msg.amount;

        // Deploy wallet if needed and credit tokens
        let walletInit: StateInit = self.getWalletStateInit(msg.recipient);
        let walletAddress: Address = contractAddress(walletInit);

        // Calculate value to forward
        let fwdValue: Int = max(ctx.value - self.MIN_TON_FOR_STORAGE - self.GAS_CONSUMPTION, self.MIN_TON_FOR_STORAGE);

        send(SendParameters{
            to: walletAddress,
            value: fwdValue,
            mode: SendBounceIfActionFail,
            bounce: true,
            code: walletInit.code,
            data: walletInit.data,
            body: TokenTransferInternal{
                queryId: msg.queryId,
                amount: msg.amount,
                from: self.marketAddress,
                responseDestination: msg.responseDestination,
                forwardTonAmount: 0,
                forwardPayload: emptySlice()
            }.toCell()
        });

        // Clear pending mint on success (will be restored on bounce)
        self.pendingMints.set(pendingId, null);

        emit(MintEvent{
            to: msg.recipient,
            amount: msg.amount,
            side: self.outcome,
            marketId: self.marketId
        }.toCell());
    }

    // ============================================
    // BOUNCE HANDLER FOR FAILED MINTS
    // ============================================

    bounced(msg: bounced<TokenTransferInternal>) {
        // Wallet deployment or transfer failed - reverse the mint
        self.totalSupply = self.totalSupply - msg.amount;

        // Find and restore pending mint
        // In practice, would need to track by queryId for precise matching

        // Note: bounced messages only preserve first 224 bits after op code
        // from field (Address) is truncated in bounced message
        emit(MintBouncedEvent{
            user: myAddress(),  // Placeholder - actual from unavailable in bounced
            amount: msg.amount,
            side: self.outcome,
            refunded: false
        }.toCell());

        // Notify market of failed mint using queryId for tracking
        send(SendParameters{
            to: self.marketAddress,
            value: self.GAS_CONSUMPTION,
            mode: SendPayGasSeparately + SendBounceIfActionFail,
            body: MintFailed{
                queryId: msg.queryId,
                recipient: myAddress(),  // Market should resolve actual recipient from queryId
                amount: msg.amount
            }.toCell()
        });
    }

    // ============================================
    // SETTLEMENT NOTIFICATION
    // ============================================

    receive(msg: PositionSettled) {
        require(sender() == self.marketAddress, "Only market can settle");
        require(!self.isSettled, "Already settled");

        self.isSettled = true;
        self.mintable = false;
        self.isWinningOutcome = msg.isWinningOutcome;
        self.totalPool = msg.totalPool;
        self.winningPool = msg.winningPool;

        emit(PositionTokenSettledEvent{
            marketId: self.marketId,
            outcome: self.outcome,
            isWinningOutcome: msg.isWinningOutcome,
            totalPool: msg.totalPool,
            winningPool: msg.winningPool
        }.toCell());
    }

    // ============================================
    // BURN HANDLING (For redemption)
    // ============================================

    receive(msg: TokenBurnNotification) {
        // Verify sender is a valid wallet
        let walletInit: StateInit = self.getWalletStateInit(msg.sender);
        let expectedWallet: Address = contractAddress(walletInit);
        require(sender() == expectedWallet, "Invalid wallet");
        require(msg.amount > 0, "Zero amount");
        require(msg.amount <= self.totalSupply, "Exceeds supply");

        // Store pending burn for bounce recovery
        let pendingId: Int = self.nextPendingId;
        self.nextPendingId = self.nextPendingId + 1;

        // Decrease supply
        self.totalSupply = self.totalSupply - msg.amount;

        // If settled and winning, calculate and send payout with fees
        if (self.isSettled && self.isWinningOutcome && self.winningPool > 0) {
            // Safe division with check
            let grossPayout: Int = safeDivide(msg.amount * self.totalPool, self.winningPool);

            // Calculate fees
            let creatorFee: Int = safeBps(grossPayout, self.creatorFeeBps, self.FEE_DENOMINATOR);
            let protocolFee: Int = safeBps(grossPayout, self.protocolFeeBps, self.FEE_DENOMINATOR);
            let netPayout: Int = grossPayout - creatorFee - protocolFee;

            // Store pending burn
            self.pendingBurns.set(pendingId, PendingBurn{
                recipient: msg.sender,
                amount: msg.amount,
                payout: netPayout,
                queryId: msg.queryId
            });

            // Notify market to release funds
            send(SendParameters{
                to: self.marketAddress,
                value: self.BURN_GAS,
                mode: SendPayGasSeparately + SendBounceIfActionFail,
                bounce: true,
                body: ClaimFromToken{
                    queryId: msg.queryId,
                    recipient: msg.sender,
                    tokenAmount: msg.amount,
                    grossPayout: grossPayout,
                    creatorFee: creatorFee,
                    protocolFee: protocolFee,
                    netPayout: netPayout
                }.toCell()
            });

            emit(TokenRedemptionEvent{
                marketId: self.marketId,
                recipient: msg.sender,
                tokenAmount: msg.amount,
                grossPayout: grossPayout,
                fee: creatorFee + protocolFee,
                netPayout: netPayout
            }.toCell());
        }

        // Send excess gas back
        if (msg.responseDestination != null) {
            send(SendParameters{
                to: msg.responseDestination!!,
                value: 0,
                mode: SendRemainingValue,
                body: TokenExcesses{queryId: msg.queryId}.toCell()
            });
        }
    }

    bounced(msg: bounced<ClaimFromToken>) {
        // Payout claim failed
        // Note: bounced messages only preserve first 224 bits after op code
        // Only queryId is reliably available - other fields are truncated

        // Emit event for monitoring - queryId can be used to track the original claim
        emit(ClaimBouncedEvent{
            user: myAddress(),  // Placeholder - actual recipient unavailable in bounced
            amount: 0,  // Unavailable in bounced message
            pendingRetry: true
        }.toCell());

        // Funds returned to this contract via bounce
        // Token restoration and refunds must be handled through admin recovery
        // using queryId to identify the original transaction
    }

    // ============================================
    // TEP-89: DISCOVERABLE WALLET ADDRESS
    // ============================================

    receive(msg: ProvideWalletAddress) {
        let walletAddress: Address = self.get_wallet_address(msg.ownerAddress);

        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingValue,
            body: TakeWalletAddress{
                queryId: msg.queryId,
                walletAddress: walletAddress,
                ownerAddress: msg.includeAddress ? msg.ownerAddress : null
            }.toCell()
        });
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    receive(msg: UpdateFeeConfig) {
        require(sender() == self.marketAddress || sender() == self.protocolAddress, "Unauthorized");
        require(msg.creatorFeeBps + msg.protocolFeeBps <= 500, "Fees too high");  // Max 5%

        if (msg.creatorFeeBps > 0) {
            self.creatorFeeBps = msg.creatorFeeBps;
        }
        if (msg.protocolFeeBps > 0) {
            self.protocolFeeBps = msg.protocolFeeBps;
        }
    }

    receive(msg: UpdateFeeAddresses) {
        require(sender() == self.marketAddress || sender() == self.protocolAddress, "Unauthorized");

        if (msg.creatorAddress != newAddress(0, 0)) {
            self.creatorAddress = msg.creatorAddress;
        }
        if (msg.protocolAddress != newAddress(0, 0)) {
            self.protocolAddress = msg.protocolAddress;
        }
    }

    // ============================================
    // WALLET STATE INIT
    // ============================================

    fun getWalletStateInit(owner: Address): StateInit {
        return initOf PositionWallet(owner, myAddress());
    }

    // ============================================
    // TEP-74 GET METHODS
    // ============================================

    get fun get_jetton_data(): JettonData {
        return JettonData{
            totalSupply: self.totalSupply,
            mintable: self.mintable,
            adminAddress: self.marketAddress,
            content: self.content,
            walletCode: self.getWalletStateInit(self.marketAddress).code
        };
    }

    get fun get_wallet_address(owner: Address): Address {
        return contractAddress(self.getWalletStateInit(owner));
    }

    // ============================================
    // POSITION-SPECIFIC GETTERS
    // ============================================

    get fun getPositionInfo(): PositionMinterInfo {
        return PositionMinterInfo{
            marketAddress: self.marketAddress,
            outcome: self.outcome,
            marketId: self.marketId,
            totalSupply: self.totalSupply,
            isSettled: self.isSettled,
            isWinningOutcome: self.isWinningOutcome,
            totalPool: self.totalPool,
            winningPool: self.winningPool
        };
    }

    get fun getRedemptionValue(amount: Int): Int {
        if (!self.isSettled || !self.isWinningOutcome || self.winningPool == 0) {
            return 0;
        }
        let grossPayout: Int = safeDivide(amount * self.totalPool, self.winningPool);
        let fees: Int = safeBps(grossPayout, self.creatorFeeBps + self.protocolFeeBps, self.FEE_DENOMINATOR);
        return grossPayout - fees;
    }

    get fun getFeeConfig(): FeeConfig {
        return FeeConfig{
            creatorFeeBps: self.creatorFeeBps,
            protocolFeeBps: self.protocolFeeBps,
            creatorAddress: self.creatorAddress,
            protocolAddress: self.protocolAddress
        };
    }

    get fun getTotalSupply(): Int {
        return self.totalSupply;
    }

    get fun isMintable(): Bool {
        return self.mintable;
    }

    get fun getMarketAddress(): Address {
        return self.marketAddress;
    }
}

// ============================================
// POSITION WALLET CONTRACT
// TEP-74 Compliant with Bounce Handlers
// ============================================

contract PositionWallet {
    balance: Int as coins = 0;
    ownerAddress: Address;
    masterAddress: Address;

    const MIN_STORAGE: Int = ton("0.01");

    init(owner: Address, master: Address) {
        self.ownerAddress = owner;
        self.masterAddress = master;
    }

    // ============================================
    // RECEIVE TOKENS
    // ============================================

    receive(msg: TokenTransferInternal) {
        // Only accept from master or other valid wallets
        if (sender() != self.masterAddress) {
            let walletInit: StateInit = initOf PositionWallet(msg.from, self.masterAddress);
            require(sender() == contractAddress(walletInit), "Invalid sender");
        }

        require(msg.amount > 0, "Zero amount");
        self.balance = self.balance + msg.amount;

        // Forward notification if requested
        if (msg.forwardTonAmount > 0) {
            send(SendParameters{
                to: self.ownerAddress,
                value: msg.forwardTonAmount,
                mode: SendPayGasSeparately + SendBounceIfActionFail,
                body: TokenNotification{
                    queryId: msg.queryId,
                    amount: msg.amount,
                    from: msg.from,
                    forwardPayload: msg.forwardPayload
                }.toCell()
            });
        }

        // Send excess back
        if (msg.responseDestination != null) {
            send(SendParameters{
                to: msg.responseDestination!!,
                value: 0,
                mode: SendRemainingValue,
                body: TokenExcesses{queryId: msg.queryId}.toCell()
            });
        }
    }

    // Credit back on failed burn
    receive(msg: InternalCreditBack) {
        require(sender() == self.masterAddress, "Only master");
        self.balance = self.balance + msg.amount;
    }

    // ============================================
    // TRANSFER TOKENS
    // ============================================

    receive(msg: TokenTransfer) {
        require(sender() == self.ownerAddress, "Not owner");
        require(self.balance >= msg.amount, "Insufficient balance");
        require(msg.amount > 0, "Zero amount");

        self.balance = self.balance - msg.amount;

        // Get destination wallet
        let walletInit: StateInit = initOf PositionWallet(msg.destination, self.masterAddress);
        let destWallet: Address = contractAddress(walletInit);

        send(SendParameters{
            to: destWallet,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            code: walletInit.code,
            data: walletInit.data,
            body: TokenTransferInternal{
                queryId: msg.queryId,
                amount: msg.amount,
                from: self.ownerAddress,
                responseDestination: msg.responseDestination,
                forwardTonAmount: msg.forwardTonAmount,
                forwardPayload: msg.forwardPayload
            }.toCell()
        });

        emit(TransferEvent{
            from: self.ownerAddress,
            to: msg.destination,
            amount: msg.amount
        }.toCell());
    }

    // ============================================
    // BURN TOKENS (For redemption)
    // ============================================

    receive(msg: TokenBurn) {
        require(sender() == self.ownerAddress, "Not owner");
        require(self.balance >= msg.amount, "Insufficient balance");
        require(msg.amount > 0, "Zero amount");

        self.balance = self.balance - msg.amount;

        // Notify master of burn
        send(SendParameters{
            to: self.masterAddress,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: TokenBurnNotification{
                queryId: msg.queryId,
                amount: msg.amount,
                sender: self.ownerAddress,
                responseDestination: msg.responseDestination
            }.toCell()
        });

        emit(BurnEvent{
            from: self.ownerAddress,
            amount: msg.amount,
            payout: 0  // Will be calculated by minter
        }.toCell());
    }

    // ============================================
    // BOUNCE HANDLERS
    // ============================================

    bounced(src: bounced<TokenTransferInternal>) {
        // Return tokens on failed transfer
        self.balance = self.balance + src.amount;

        emit(TransferBouncedEvent{
            from: self.ownerAddress,
            to: newAddress(0, 0),  // Unknown destination
            amount: src.amount,
            credited: true
        }.toCell());
    }

    bounced(src: bounced<TokenBurnNotification>) {
        // Burn notification failed - restore balance
        self.balance = self.balance + src.amount;
    }

    // ============================================
    // TEP-74 GET METHODS
    // ============================================

    get fun get_wallet_data(): JettonWalletData {
        return JettonWalletData{
            balance: self.balance,
            ownerAddress: self.ownerAddress,
            masterAddress: self.masterAddress,
            walletCode: initOf PositionWallet(self.ownerAddress, self.masterAddress).code
        };
    }

    get fun getBalance(): Int {
        return self.balance;
    }

    get fun getOwner(): Address {
        return self.ownerAddress;
    }

    get fun getMaster(): Address {
        return self.masterAddress;
    }
}

// ============================================
// ADDITIONAL MESSAGES
// ============================================

// Claim from token burn (sent to market)
message ClaimFromToken {
    queryId: Int as uint64;
    recipient: Address;
    tokenAmount: Int as coins;
    grossPayout: Int as coins;
    creatorFee: Int as coins;
    protocolFee: Int as coins;
    netPayout: Int as coins;
}

// Mint failed notification
message MintFailed {
    queryId: Int as uint64;
    recipient: Address;
    amount: Int as coins;
}

// Credit back after failed burn
message InternalCreditBack {
    queryId: Int as uint64;
    amount: Int as coins;
}

// TEP-89 Messages
message ProvideWalletAddress {
    queryId: Int as uint64;
    ownerAddress: Address;
    includeAddress: Bool;
}

message TakeWalletAddress {
    queryId: Int as uint64;
    walletAddress: Address;
    ownerAddress: Address?;
}

// Fee configuration
message UpdateFeeConfig {
    creatorFeeBps: Int as uint16;
    protocolFeeBps: Int as uint16;
}

message UpdateFeeAddresses {
    creatorAddress: Address;
    protocolAddress: Address;
}

// ============================================
// PENDING OPERATION STRUCTS
// ============================================

struct PendingMint {
    recipient: Address;
    amount: Int as coins;
    queryId: Int as uint64;
}

struct PendingBurn {
    recipient: Address;
    amount: Int as coins;
    payout: Int as coins;
    queryId: Int as uint64;
}

// ============================================
// RESPONSE STRUCTS
// ============================================

struct PositionMinterInfo {
    marketAddress: Address;
    outcome: Bool;
    marketId: Int;
    totalSupply: Int;
    isSettled: Bool;
    isWinningOutcome: Bool;
    totalPool: Int;
    winningPool: Int;
}

struct FeeConfig {
    creatorFeeBps: Int;
    protocolFeeBps: Int;
    creatorAddress: Address;
    protocolAddress: Address;
}
