// ============================================
// UPGRADEABLE CONTRACT TRAIT
// TON Proxy Pattern for Contract Upgrades
// With Multi-sig Approval and Timelock
// ============================================

import "./events.tact";

// ============================================
// UPGRADE MESSAGES
// ============================================

message InternalUpgrade {
    queryId: Int as uint64;
    newCode: Cell;
    newData: Cell?;
    migrateData: Bool;
}

message SetProxyAdmin {
    newProxyAdmin: Address;
}

message GetContractState {
    queryId: Int as uint64;
}

message ContractStateResponse {
    queryId: Int as uint64;
    version: Int as uint16;
    stateHash: Int as uint256;
    isUpgradeable: Bool;
}

// ============================================
// UPGRADEABLE TRAIT
// Inherit this trait to make a contract upgradeable
// ============================================

trait Upgradeable {
    // Required state - must be defined in implementing contract
    // Note: serialization specifiers should be in the implementing contract
    proxyAdmin: Address;
    contractVersion: Int;
    upgradeEnabled: Bool;

    // ============================================
    // UPGRADE RECEIVER
    // Only callable by the ProxyAdmin contract
    // ============================================

    receive(msg: InternalUpgrade) {
        // Strict authorization check
        require(sender() == self.proxyAdmin, "Upgrade: only proxy admin");
        require(self.upgradeEnabled, "Upgrade: upgrades disabled");

        // Store current state hash for verification
        let oldStateHash: Int = self.getStateHash();
        let oldVersion: Int = self.contractVersion;

        // Increment version
        self.contractVersion = self.contractVersion + 1;

        // Perform the upgrade
        if (msg.migrateData && msg.newData != null) {
            // Full upgrade with data migration
            nativeSetData(msg.newData!!);
        }

        // Set new code (this takes effect after the current transaction)
        nativeSetCode(msg.newCode);

        // Emit upgrade event
        emit(ContractUpgradedEvent{
            oldStateHash: oldStateHash,
            newCodeHash: msg.newCode.hash(),
            version: self.contractVersion
        }.toCell());
    }

    // ============================================
    // PROXY ADMIN MANAGEMENT
    // ============================================

    receive(msg: SetProxyAdmin) {
        require(sender() == self.proxyAdmin, "Only proxy admin");
        require(msg.newProxyAdmin != newAddress(0, 0), "Invalid admin address");

        self.proxyAdmin = msg.newProxyAdmin;
    }

    // ============================================
    // STATE QUERY
    // ============================================

    receive(msg: GetContractState) {
        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingValue,
            body: ContractStateResponse{
                queryId: msg.queryId,
                version: self.contractVersion,
                stateHash: self.getStateHash(),
                isUpgradeable: self.upgradeEnabled
            }.toCell()
        });
    }

    // ============================================
    // ABSTRACT METHODS
    // Must be implemented by the contract
    // ============================================

    // Returns a hash representing critical contract state
    // Used to verify state consistency after upgrades
    abstract fun getStateHash(): Int;

    // ============================================
    // VIEW METHODS
    // ============================================

    get fun getContractVersion(): Int {
        return self.contractVersion;
    }

    get fun getProxyAdmin(): Address {
        return self.proxyAdmin;
    }

    get fun isUpgradeEnabled(): Bool {
        return self.upgradeEnabled;
    }
}

// ============================================
// EMERGENCY CONTROL LEVELS
// Used across all contracts for graduated response
// ============================================

const EMERGENCY_NONE: Int = 0;           // Normal operation
const EMERGENCY_PAUSE_NEW_BETS: Int = 1; // Block new bets/orders
const EMERGENCY_PAUSE_TRADING: Int = 2;  // Block all trading
const EMERGENCY_PAUSE_ALL: Int = 3;      // Block all operations except claims
const EMERGENCY_DRAIN: Int = 4;          // Allow emergency withdrawal

// ============================================
// EMERGENCY CONTROL TRAIT
// Provides multi-level circuit breaker functionality
// ============================================

message SetEmergencyLevel {
    level: Int as uint8;
    reason: String;
}

message EmergencyWithdraw {
    to: Address;
    amount: Int as coins;
}

trait EmergencyControl {
    // Note: serialization specifiers should be in the implementing contract
    emergencyLevel: Int;
    emergencyAdmin: Address;
    lastEmergencyChange: Int;
    owner: Address;

    const EMERGENCY_COOLDOWN: Int = 3600; // 1 hour between level changes

    receive(msg: SetEmergencyLevel) {
        // Authorization check
        require(
            sender() == self.emergencyAdmin ||
            sender() == self.owner,
            "Emergency: unauthorized"
        );
        require(msg.level <= EMERGENCY_DRAIN, "Emergency: invalid level");
        require(now() >= self.lastEmergencyChange + self.EMERGENCY_COOLDOWN, "Emergency: cooldown active");

        // Only owner can make large jumps in emergency level
        if (sender() != self.owner) {
            require(msg.level <= self.emergencyLevel + 1, "Emergency: can only increase by 1");
        }

        let oldLevel: Int = self.emergencyLevel;
        self.emergencyLevel = msg.level;
        self.lastEmergencyChange = now();

        emit(EmergencyLevelChangedEvent{
            oldLevel: oldLevel,
            newLevel: msg.level,
            reason: msg.reason,
            changedBy: sender(),
            timestamp: now()
        }.toCell());
    }

    receive(msg: EmergencyWithdraw) {
        require(sender() == self.owner, "Emergency: owner only");
        require(self.emergencyLevel == EMERGENCY_DRAIN, "Emergency: not in drain mode");

        let available: Int = myBalance() - ton("0.01"); // Keep minimal for storage
        let withdrawAmount: Int = min(msg.amount, available);

        require(withdrawAmount > 0, "Emergency: nothing to withdraw");

        send(SendParameters{
            to: msg.to,
            value: withdrawAmount,
            mode: SendBounceIfActionFail,
            body: beginCell()
                .storeUint(OP_EMERGENCY_WITHDRAW, 32)
                .storeCoins(withdrawAmount)
                .endCell()
        });

        emit(EmergencyWithdrawEvent{
            to: msg.to,
            amount: withdrawAmount,
            initiatedBy: sender(),
            timestamp: now()
        }.toCell());
    }

    // ============================================
    // EMERGENCY CHECK HELPERS
    // ============================================

    fun requireNotPaused() {
        require(self.emergencyLevel < EMERGENCY_PAUSE_TRADING, "Trading paused");
    }

    fun requireNewBetsAllowed() {
        require(self.emergencyLevel < EMERGENCY_PAUSE_NEW_BETS, "New bets paused");
    }

    fun requireClaimsAllowed() {
        require(self.emergencyLevel < EMERGENCY_PAUSE_ALL, "All operations paused");
    }

    fun requireNormalOperation() {
        require(self.emergencyLevel == EMERGENCY_NONE, "Emergency mode active");
    }

    get fun getEmergencyLevel(): Int {
        return self.emergencyLevel;
    }

    get fun getEmergencyAdmin(): Address {
        return self.emergencyAdmin;
    }
}

// ============================================
// STORAGE BOUNDS TRAIT
// Prevents unbounded state growth
// ============================================

trait StorageBounds {
    // These constants should be overridden per contract
    const MAX_ORDERS: Int = 1000;
    const MAX_DISPUTES: Int = 100;
    const MAX_POSITIONS: Int = 10000;

    fun requireStorageCapacity(currentCount: Int, maxCount: Int, limitType: String) {
        if (currentCount >= maxCount) {
            emit(StorageLimitReachedEvent{
                contractAddress: myAddress(),
                limitType: limitType,
                currentCount: currentCount,
                maxCount: maxCount
            }.toCell());
            require(false, "Storage limit reached");
        }
    }
}

// ============================================
// SAFE MATH HELPERS
// ============================================

inline fun safeDivide(numerator: Int, denominator: Int): Int {
    require(denominator > 0, "Division by zero");
    return numerator / denominator;
}

inline fun safeBps(amount: Int, bps: Int, total: Int): Int {
    require(total > 0, "Division by zero");
    return (amount * bps) / total;
}

// Note: min, max, abs are built-in Tact functions - no need to redefine

// Null-coalescing helper for map lookups
inline fun getOrDefault(opt: Int?, defaultValue: Int): Int {
    if (opt == null) { return defaultValue; }
    return opt!!;
}

inline fun getOrDefaultBool(opt: Bool?, defaultValue: Bool): Bool {
    if (opt == null) { return defaultValue; }
    return opt!!;
}

// ============================================
// NATIVE FUNCTIONS FOR UPGRADES
// ============================================

@name(set_code)
native nativeSetCode(code: Cell);

@name(set_data)
native nativeSetData(data: Cell);
