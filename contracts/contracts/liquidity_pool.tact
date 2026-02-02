import "@stdlib/deploy";
import "./events.tact";

// ============================================
// WHETHER LIQUIDITY POOL
// Global weather fund for hackathon demo
// ============================================

struct LiquidityPoolInit {
    owner: Address;
    lpTokenMaster: Address;
    factoryAddress: Address;
}

// ============================================
// MESSAGES
// ============================================

message Deposit {
    queryId: Int as uint64;
}

message Withdraw {
    queryId: Int as uint64;
    shares: Int as coins;
}

message CollectFees {
    queryId: Int as uint64;
    marketAddress: Address;
    amount: Int as coins;
}

message RegisterMarket {
    marketAddress: Address;
}

message UnregisterMarket {
    marketAddress: Address;
}

message UpdateConfig {
    minDeposit: Int as coins;
    withdrawalFeeBps: Int as uint16;
}

message EmergencyWithdraw {
    to: Address;
    amount: Int as coins;
}

// Internal messages from LP token
message LPTokenMinted {
    queryId: Int as uint64;
    to: Address;
    amount: Int as coins;
}

message LPTokenBurned {
    queryId: Int as uint64;
    from: Address;
    amount: Int as coins;
}

// ============================================
// EVENTS
// ============================================

message DepositEvent {
    depositor: Address;
    amount: Int as coins;
    sharesMinted: Int as coins;
    sharePrice: Int as coins;
    timestamp: Int as uint64;
}

message WithdrawEvent {
    withdrawer: Address;
    shares: Int as coins;
    amountReceived: Int as coins;
    fee: Int as coins;
    sharePrice: Int as coins;
    timestamp: Int as uint64;
}

message FeesCollectedEvent {
    marketAddress: Address;
    amount: Int as coins;
    newTvl: Int as coins;
    timestamp: Int as uint64;
}

message PoolStatsUpdatedEvent {
    tvl: Int as coins;
    totalShares: Int as coins;
    sharePrice: Int as coins;
    accruedFees: Int as coins;
}

// ============================================
// STRUCTS
// ============================================

struct PoolStats {
    tvl: Int;
    totalShares: Int;
    sharePrice: Int;
    accruedFees: Int;
    totalDeposits: Int;
    totalWithdrawals: Int;
    lpCount: Int;
}

struct LPPosition {
    shares: Int;
    depositedValue: Int;
    currentValue: Int;
    earnings: Int;
}

// ============================================
// CONTRACT
// ============================================

contract LiquidityPool with Deployable {
    // Config
    owner: Address;
    lpTokenMaster: Address;
    factoryAddress: Address;

    // Pool state
    totalValueLocked: Int as coins = 0;
    totalShares: Int as coins = 0;
    accruedFees: Int as coins = 0;
    totalFeesCollected: Int as coins = 0;

    // LP tracking
    lpPositions: map<Address, Int>;  // address -> shares
    lpDeposits: map<Address, Int>;   // address -> total deposited value
    lpCount: Int as uint32 = 0;

    // Stats
    totalDeposits: Int as coins = 0;
    totalWithdrawals: Int as coins = 0;

    // Registered markets (can send fees)
    registeredMarkets: map<Address, Bool>;

    // Config
    minDeposit: Int as coins = ton("1");  // 1 TON minimum
    withdrawalFeeBps: Int as uint16 = 0;  // No withdrawal fee for hackathon

    // Constants
    const MIN_STORAGE_RESERVE: Int = ton("0.05");
    const MINT_GAS: Int = ton("0.1");
    const SHARE_DECIMALS: Int = 1000000000;  // 9 decimals for precision

    init(params: LiquidityPoolInit) {
        self.owner = params.owner;
        self.lpTokenMaster = params.lpTokenMaster;
        self.factoryAddress = params.factoryAddress;
    }

    // ============================================
    // DEPOSIT
    // ============================================

    receive(msg: Deposit) {
        let depositAmount: Int = context().value - self.MINT_GAS;
        require(depositAmount >= self.minDeposit, "Deposit too small");

        let depositor: Address = sender();

        // Calculate shares to mint based on current share price
        let sharesToMint: Int = self.calculateSharesForDeposit(depositAmount);
        require(sharesToMint > 0, "Invalid share calculation");

        // Update TVL
        self.totalValueLocked = self.totalValueLocked + depositAmount;
        self.totalShares = self.totalShares + sharesToMint;
        self.totalDeposits = self.totalDeposits + depositAmount;

        // Track LP position
        let existingShares: Int = self.getOrDefault(self.lpPositions.get(depositor), 0);
        let existingDeposit: Int = self.getOrDefault(self.lpDeposits.get(depositor), 0);

        if (existingShares == 0) {
            self.lpCount = self.lpCount + 1;
        }

        self.lpPositions.set(depositor, existingShares + sharesToMint);
        self.lpDeposits.set(depositor, existingDeposit + depositAmount);

        // Emit event
        emit(DepositEvent{
            depositor: depositor,
            amount: depositAmount,
            sharesMinted: sharesToMint,
            sharePrice: self.getSharePrice(),
            timestamp: now()
        }.toCell());
    }

    // ============================================
    // WITHDRAW
    // ============================================

    receive(msg: Withdraw) {
        let withdrawer: Address = sender();
        let shares: Int = msg.shares;

        let existingShares: Int = self.getOrDefault(self.lpPositions.get(withdrawer), 0);
        require(existingShares >= shares, "Insufficient shares");
        require(shares > 0, "Invalid withdrawal amount");

        // Calculate withdrawal amount based on share price
        let withdrawalAmount: Int = self.calculateWithdrawalAmount(shares);
        require(withdrawalAmount > 0, "Invalid withdrawal calculation");

        // Apply withdrawal fee if configured
        let fee: Int = (withdrawalAmount * self.withdrawalFeeBps) / 10000;
        let netAmount: Int = withdrawalAmount - fee;

        // Verify sufficient balance
        let available: Int = myBalance() - self.MIN_STORAGE_RESERVE;
        require(netAmount <= available, "Insufficient pool balance");

        // Update state
        self.totalValueLocked = self.totalValueLocked - withdrawalAmount;
        self.totalShares = self.totalShares - shares;
        self.totalWithdrawals = self.totalWithdrawals + netAmount;

        // Add fee back to TVL (benefits remaining LPs)
        if (fee > 0) {
            self.totalValueLocked = self.totalValueLocked + fee;
            self.accruedFees = self.accruedFees + fee;
        }

        // Update LP position
        let newShares: Int = existingShares - shares;
        if (newShares == 0) {
            self.lpPositions.set(withdrawer, null);
            self.lpDeposits.set(withdrawer, null);
            self.lpCount = self.lpCount - 1;
        } else {
            self.lpPositions.set(withdrawer, newShares);
            // Proportionally reduce deposit tracking
            let existingDeposit: Int = self.getOrDefault(self.lpDeposits.get(withdrawer), 0);
            let depositReduction: Int = (existingDeposit * shares) / existingShares;
            self.lpDeposits.set(withdrawer, existingDeposit - depositReduction);
        }

        // Send withdrawal
        send(SendParameters{
            to: withdrawer,
            value: netAmount,
            mode: SendPayGasSeparately,
            body: beginCell()
                .storeUint(0x00000010, 32)  // op::withdrawal_success
                .storeCoins(netAmount)
                .storeCoins(shares)
                .endCell()
        });

        // Emit event
        emit(WithdrawEvent{
            withdrawer: withdrawer,
            shares: shares,
            amountReceived: netAmount,
            fee: fee,
            sharePrice: self.getSharePrice(),
            timestamp: now()
        }.toCell());
    }

    // ============================================
    // FEE COLLECTION (from settled markets)
    // ============================================

    receive(msg: CollectFees) {
        // Only registered markets or factory can send fees
        let isRegistered: Bool = self.getOrDefaultBool(self.registeredMarkets.get(sender()), false);
        require(
            isRegistered || sender() == self.factoryAddress || sender() == self.owner,
            "Not authorized to send fees"
        );

        let feeAmount: Int = context().value;
        require(feeAmount > 0, "No fees to collect");

        // Add fees to TVL (increases share price)
        self.totalValueLocked = self.totalValueLocked + feeAmount;
        self.accruedFees = self.accruedFees + feeAmount;
        self.totalFeesCollected = self.totalFeesCollected + feeAmount;

        // Emit event
        emit(FeesCollectedEvent{
            marketAddress: msg.marketAddress,
            amount: feeAmount,
            newTvl: self.totalValueLocked,
            timestamp: now()
        }.toCell());
    }

    // ============================================
    // MARKET REGISTRATION
    // ============================================

    receive(msg: RegisterMarket) {
        require(
            sender() == self.factoryAddress || sender() == self.owner,
            "Only factory or owner can register markets"
        );
        self.registeredMarkets.set(msg.marketAddress, true);
    }

    receive(msg: UnregisterMarket) {
        require(
            sender() == self.factoryAddress || sender() == self.owner,
            "Only factory or owner can unregister markets"
        );
        self.registeredMarkets.set(msg.marketAddress, null);
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    receive(msg: UpdateConfig) {
        require(sender() == self.owner, "Only owner");
        self.minDeposit = msg.minDeposit;
        self.withdrawalFeeBps = msg.withdrawalFeeBps;
    }

    receive(msg: EmergencyWithdraw) {
        require(sender() == self.owner, "Only owner");

        let available: Int = myBalance() - self.MIN_STORAGE_RESERVE;
        let amount: Int = min(msg.amount, available);

        if (amount > 0) {
            send(SendParameters{
                to: msg.to,
                value: amount,
                mode: SendPayGasSeparately,
                body: beginCell()
                    .storeUint(OP_EMERGENCY_WITHDRAW, 32)
                    .storeCoins(amount)
                    .endCell()
            });

            emit(EmergencyWithdrawEvent{
                to: msg.to,
                amount: amount,
                initiatedBy: sender(),
                timestamp: now()
            }.toCell());
        }
    }

    // ============================================
    // INTERNAL HELPERS
    // ============================================

    fun calculateSharesForDeposit(depositAmount: Int): Int {
        if (self.totalShares == 0 || self.totalValueLocked == 0) {
            // First deposit: 1 TON = 1 share (with decimals)
            return depositAmount;
        }
        // shares = deposit * totalShares / TVL
        return (depositAmount * self.totalShares) / self.totalValueLocked;
    }

    fun calculateWithdrawalAmount(shares: Int): Int {
        if (self.totalShares == 0) {
            return 0;
        }
        // amount = shares * TVL / totalShares
        return (shares * self.totalValueLocked) / self.totalShares;
    }

    fun getOrDefault(value: Int?, defaultVal: Int): Int {
        if (value == null) {
            return defaultVal;
        }
        return value!!;
    }

    fun getOrDefaultBool(value: Bool?, defaultVal: Bool): Bool {
        if (value == null) {
            return defaultVal;
        }
        return value!!;
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    get fun getPoolStats(): PoolStats {
        return PoolStats{
            tvl: self.totalValueLocked,
            totalShares: self.totalShares,
            sharePrice: self.getSharePrice(),
            accruedFees: self.accruedFees,
            totalDeposits: self.totalDeposits,
            totalWithdrawals: self.totalWithdrawals,
            lpCount: self.lpCount
        };
    }

    get fun getSharePrice(): Int {
        if (self.totalShares == 0) {
            return self.SHARE_DECIMALS;  // 1.0 when no shares
        }
        // Share price with 9 decimal precision
        return (self.totalValueLocked * self.SHARE_DECIMALS) / self.totalShares;
    }

    get fun getTvl(): Int {
        return self.totalValueLocked;
    }

    get fun getTotalShares(): Int {
        return self.totalShares;
    }

    get fun getAccruedFees(): Int {
        return self.accruedFees;
    }

    get fun getTotalFeesCollected(): Int {
        return self.totalFeesCollected;
    }

    get fun getLpCount(): Int {
        return self.lpCount;
    }

    get fun getLpPosition(user: Address): LPPosition {
        let shares: Int = self.getOrDefault(self.lpPositions.get(user), 0);
        let depositedValue: Int = self.getOrDefault(self.lpDeposits.get(user), 0);
        let currentValue: Int = self.calculateWithdrawalAmount(shares);
        let earnings: Int = currentValue > depositedValue ? currentValue - depositedValue : 0;

        return LPPosition{
            shares: shares,
            depositedValue: depositedValue,
            currentValue: currentValue,
            earnings: earnings
        };
    }

    get fun getLpShares(user: Address): Int {
        return self.getOrDefault(self.lpPositions.get(user), 0);
    }

    get fun isMarketRegistered(market: Address): Bool {
        return self.getOrDefaultBool(self.registeredMarkets.get(market), false);
    }

    get fun getMinDeposit(): Int {
        return self.minDeposit;
    }

    get fun getWithdrawalFeeBps(): Int {
        return self.withdrawalFeeBps;
    }

    get fun getOwner(): Address {
        return self.owner;
    }

    get fun getFactoryAddress(): Address {
        return self.factoryAddress;
    }

    get fun calculateSharesPreview(depositAmount: Int): Int {
        return self.calculateSharesForDeposit(depositAmount);
    }

    get fun calculateWithdrawalPreview(shares: Int): Int {
        let amount: Int = self.calculateWithdrawalAmount(shares);
        let fee: Int = (amount * self.withdrawalFeeBps) / 10000;
        return amount - fee;
    }
}
