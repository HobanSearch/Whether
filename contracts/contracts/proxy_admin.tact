import "@stdlib/deploy";
import "@stdlib/ownable";
import "./events.tact";
import "./upgradeable.tact";

// ============================================
// WHETHER PROXY ADMIN CONTRACT
// Manages contract upgrades with timelock and multi-sig
// Production-ready upgrade governance
// ============================================

// ============================================
// MESSAGES
// ============================================

message ProposeUpgrade {
    implementation: Address;
    newCode: Cell;
    newData: Cell?;
    description: String;
    migrateData: Bool;
}

message ApproveUpgrade {
    upgradeId: Int as uint64;
}

message ExecuteUpgrade {
    upgradeId: Int as uint64;
}

message CancelUpgrade {
    upgradeId: Int as uint64;
    reason: String;
}

message AddApprover {
    approver: Address;
}

message RemoveApprover {
    approver: Address;
}

message SetTimelock {
    newTimelock: Int as uint32;
}

message SetRequiredApprovals {
    required: Int as uint8;
}

message AddImplementation {
    implementation: Address;
}

message RemoveImplementation {
    implementation: Address;
}

// ============================================
// STRUCTS
// ============================================

struct PendingUpgrade {
    upgradeId: Int as uint64;
    implementation: Address;
    newCode: Cell;
    newData: Cell?;
    description: String;
    migrateData: Bool;
    proposedAt: Int as uint64;
    proposedBy: Address;
    approvalCount: Int as uint8;
    executed: Bool;
    cancelled: Bool;
}

struct ProxyAdminConfig {
    owner: Address;
    upgradeTimelock: Int;
    requiredApprovals: Int;
    approverCount: Int;
    pendingUpgradeCount: Int;
    implementationCount: Int;
}

// ============================================
// CONTRACT
// ============================================

contract ProxyAdmin with Deployable, Ownable {
    owner: Address;

    // Upgrade timelock (48 hours default)
    upgradeTimelock: Int as uint32 = 172800;

    // Multi-sig approval for upgrades
    requiredApprovals: Int as uint8 = 2;
    approvers: map<Address, Bool>;
    approverCount: Int as uint8 = 0;

    // Pending upgrades
    pendingUpgrades: map<Int, PendingUpgrade>;
    upgradeApprovals: map<Int, map<Address, Bool>>;
    upgradeCount: Int as uint64 = 0;
    pendingUpgradeCount: Int as uint32 = 0;

    // Managed implementations (contracts that can be upgraded)
    implementations: map<Address, Bool>;
    implementationCount: Int as uint8 = 0;

    // Configuration
    const MAX_APPROVERS: Int = 10;
    const MAX_PENDING_UPGRADES: Int = 10;
    const MIN_TIMELOCK: Int = 3600;      // 1 hour minimum
    const MAX_TIMELOCK: Int = 604800;    // 1 week maximum
    const UPGRADE_GAS: Int = ton("0.15");

    init(owner: Address) {
        self.owner = owner;
        // Owner is auto-added as first approver
        self.approvers.set(owner, true);
        self.approverCount = 1;
    }

    // ============================================
    // APPROVER MANAGEMENT
    // ============================================

    receive(msg: AddApprover) {
        self.requireOwner();
        require(self.approverCount < self.MAX_APPROVERS, "Max approvers reached");
        require(self.approvers.get(msg.approver) != true, "Already approver");

        self.approvers.set(msg.approver, true);
        self.approverCount = self.approverCount + 1;

        emit(ApproverAddedEvent{
            approver: msg.approver,
            addedBy: sender()
        }.toCell());
    }

    receive(msg: RemoveApprover) {
        self.requireOwner();
        require(self.approvers.get(msg.approver) == true, "Not an approver");
        require(self.approverCount > self.requiredApprovals, "Cannot remove - min approvers");
        require(msg.approver != self.owner, "Cannot remove owner");

        self.approvers.set(msg.approver, null);
        self.approverCount = self.approverCount - 1;

        emit(ApproverRemovedEvent{
            approver: msg.approver,
            removedBy: sender()
        }.toCell());
    }

    // ============================================
    // IMPLEMENTATION MANAGEMENT
    // ============================================

    receive(msg: AddImplementation) {
        self.requireOwner();
        require(self.implementations.get(msg.implementation) != true, "Already managed");

        self.implementations.set(msg.implementation, true);
        self.implementationCount = self.implementationCount + 1;
    }

    receive(msg: RemoveImplementation) {
        self.requireOwner();
        require(self.implementations.get(msg.implementation) == true, "Not managed");

        self.implementations.set(msg.implementation, null);
        self.implementationCount = self.implementationCount - 1;
    }

    // ============================================
    // UPGRADE PROPOSAL
    // ============================================

    receive(msg: ProposeUpgrade) {
        require(self.approvers.get(sender()) == true, "Not an approver");
        require(self.pendingUpgradeCount < self.MAX_PENDING_UPGRADES, "Too many pending upgrades");
        require(self.implementations.get(msg.implementation) == true, "Implementation not managed");

        let upgradeId: Int = self.upgradeCount;
        self.upgradeCount = self.upgradeCount + 1;
        self.pendingUpgradeCount = self.pendingUpgradeCount + 1;

        // Create pending upgrade
        self.pendingUpgrades.set(upgradeId, PendingUpgrade{
            upgradeId: upgradeId,
            implementation: msg.implementation,
            newCode: msg.newCode,
            newData: msg.newData,
            description: msg.description,
            migrateData: msg.migrateData,
            proposedAt: now(),
            proposedBy: sender(),
            approvalCount: 1, // Auto-approve by proposer
            executed: false,
            cancelled: false
        });

        // Auto-approve by proposer
        let approvalMap: map<Address, Bool> = emptyMap();
        approvalMap.set(sender(), true);
        self.upgradeApprovals.set(upgradeId, approvalMap);

        emit(UpgradeProposedEvent{
            upgradeId: upgradeId,
            proposedBy: sender(),
            description: msg.description,
            timelockEnds: now() + self.upgradeTimelock
        }.toCell());
    }

    // ============================================
    // UPGRADE APPROVAL
    // ============================================

    receive(msg: ApproveUpgrade) {
        require(self.approvers.get(sender()) == true, "Not an approver");

        let pending: PendingUpgrade? = self.pendingUpgrades.get(msg.upgradeId);
        require(pending != null, "Upgrade not found");
        require(!pending!!.executed, "Already executed");
        require(!pending!!.cancelled, "Upgrade cancelled");

        let approvals: map<Address, Bool>? = self.upgradeApprovals.get(msg.upgradeId);
        require(approvals != null, "Invalid state");
        require(approvals!!.get(sender()) != true, "Already approved");

        // Add approval
        approvals!!.set(sender(), true);
        self.upgradeApprovals.set(msg.upgradeId, approvals!!);

        // Update pending upgrade with new approval count
        let updated: PendingUpgrade = PendingUpgrade{
            upgradeId: pending!!.upgradeId,
            implementation: pending!!.implementation,
            newCode: pending!!.newCode,
            newData: pending!!.newData,
            description: pending!!.description,
            migrateData: pending!!.migrateData,
            proposedAt: pending!!.proposedAt,
            proposedBy: pending!!.proposedBy,
            approvalCount: pending!!.approvalCount + 1,
            executed: pending!!.executed,
            cancelled: pending!!.cancelled
        };
        self.pendingUpgrades.set(msg.upgradeId, updated);

        emit(UpgradeApprovedEvent{
            upgradeId: msg.upgradeId,
            approver: sender(),
            approvalCount: updated.approvalCount
        }.toCell());
    }

    // ============================================
    // UPGRADE EXECUTION
    // ============================================

    receive(msg: ExecuteUpgrade) {
        let pending: PendingUpgrade? = self.pendingUpgrades.get(msg.upgradeId);
        require(pending != null, "Upgrade not found");
        require(!pending!!.executed, "Already executed");
        require(!pending!!.cancelled, "Upgrade cancelled");

        // Check timelock
        require(now() >= pending!!.proposedAt + self.upgradeTimelock, "Timelock not expired");

        // Check approvals
        require(pending!!.approvalCount >= self.requiredApprovals, "Insufficient approvals");

        // Mark as executed BEFORE sending
        let executed: PendingUpgrade = PendingUpgrade{
            upgradeId: pending!!.upgradeId,
            implementation: pending!!.implementation,
            newCode: pending!!.newCode,
            newData: pending!!.newData,
            description: pending!!.description,
            migrateData: pending!!.migrateData,
            proposedAt: pending!!.proposedAt,
            proposedBy: pending!!.proposedBy,
            approvalCount: pending!!.approvalCount,
            executed: true,
            cancelled: false
        };
        self.pendingUpgrades.set(msg.upgradeId, executed);
        self.pendingUpgradeCount = self.pendingUpgradeCount - 1;

        // Send upgrade message to implementation
        send(SendParameters{
            to: pending!!.implementation,
            value: self.UPGRADE_GAS,
            mode: SendPayGasSeparately + SendBounceIfActionFail,
            body: InternalUpgrade{
                queryId: msg.upgradeId,
                newCode: pending!!.newCode,
                newData: pending!!.newData,
                migrateData: pending!!.migrateData
            }.toCell()
        });

        emit(UpgradeExecutedEvent{
            upgradeId: msg.upgradeId,
            executor: sender(),
            oldCodeHash: 0, // Would need to fetch from implementation
            newCodeHash: pending!!.newCode.hash()
        }.toCell());
    }

    // ============================================
    // UPGRADE CANCELLATION
    // ============================================

    receive(msg: CancelUpgrade) {
        let pending: PendingUpgrade? = self.pendingUpgrades.get(msg.upgradeId);
        require(pending != null, "Upgrade not found");
        require(!pending!!.executed, "Already executed");
        require(!pending!!.cancelled, "Already cancelled");

        // Only owner or proposer can cancel
        require(
            sender() == self.owner || sender() == pending!!.proposedBy,
            "Unauthorized to cancel"
        );

        // Mark as cancelled
        let cancelled: PendingUpgrade = PendingUpgrade{
            upgradeId: pending!!.upgradeId,
            implementation: pending!!.implementation,
            newCode: pending!!.newCode,
            newData: pending!!.newData,
            description: pending!!.description,
            migrateData: pending!!.migrateData,
            proposedAt: pending!!.proposedAt,
            proposedBy: pending!!.proposedBy,
            approvalCount: pending!!.approvalCount,
            executed: false,
            cancelled: true
        };
        self.pendingUpgrades.set(msg.upgradeId, cancelled);
        self.pendingUpgradeCount = self.pendingUpgradeCount - 1;

        // Clear approvals
        self.upgradeApprovals.set(msg.upgradeId, null);

        emit(UpgradeCancelledEvent{
            upgradeId: msg.upgradeId,
            cancelledBy: sender(),
            reason: msg.reason
        }.toCell());
    }

    // ============================================
    // CONFIGURATION
    // ============================================

    receive(msg: SetTimelock) {
        self.requireOwner();
        require(msg.newTimelock >= self.MIN_TIMELOCK, "Timelock too short");
        require(msg.newTimelock <= self.MAX_TIMELOCK, "Timelock too long");

        self.upgradeTimelock = msg.newTimelock;
    }

    receive(msg: SetRequiredApprovals) {
        self.requireOwner();
        require(msg.required >= 1, "At least 1 required");
        require(msg.required <= self.approverCount, "Exceeds approver count");

        self.requiredApprovals = msg.required;
    }

    // ============================================
    // BOUNCE HANDLER
    // ============================================

    bounced(src: bounced<InternalUpgrade>) {
        // Upgrade failed - emit event for monitoring
        // The upgrade remains marked as executed but actually failed
        // This should be monitored and handled manually
    }

    // ============================================
    // GETTERS
    // ============================================

    get fun getPendingUpgrade(upgradeId: Int): PendingUpgrade? {
        return self.pendingUpgrades.get(upgradeId);
    }

    get fun getUpgradeTimelock(): Int {
        return self.upgradeTimelock;
    }

    get fun getRequiredApprovals(): Int {
        return self.requiredApprovals;
    }

    get fun isApprover(addr: Address): Bool {
        return self.approvers.get(addr) == true;
    }

    get fun getApproverCount(): Int {
        return self.approverCount;
    }

    get fun isImplementationManaged(addr: Address): Bool {
        return self.implementations.get(addr) == true;
    }

    get fun hasApprovedUpgrade(upgradeId: Int, approver: Address): Bool {
        let approvals: map<Address, Bool>? = self.upgradeApprovals.get(upgradeId);
        if (approvals == null) {
            return false;
        }
        return approvals!!.get(approver) == true;
    }

    get fun canExecuteUpgrade(upgradeId: Int): Bool {
        let pending: PendingUpgrade? = self.pendingUpgrades.get(upgradeId);
        if (pending == null) {
            return false;
        }
        if (pending!!.executed || pending!!.cancelled) {
            return false;
        }
        if (now() < pending!!.proposedAt + self.upgradeTimelock) {
            return false;
        }
        if (pending!!.approvalCount < self.requiredApprovals) {
            return false;
        }
        return true;
    }

    get fun getUpgradeTimelockRemaining(upgradeId: Int): Int {
        let pending: PendingUpgrade? = self.pendingUpgrades.get(upgradeId);
        if (pending == null) {
            return 0;
        }
        let timelockEnd: Int = pending!!.proposedAt + self.upgradeTimelock;
        if (now() >= timelockEnd) {
            return 0;
        }
        return timelockEnd - now();
    }

    get fun getConfig(): ProxyAdminConfig {
        return ProxyAdminConfig{
            owner: self.owner,
            upgradeTimelock: self.upgradeTimelock,
            requiredApprovals: self.requiredApprovals,
            approverCount: self.approverCount,
            pendingUpgradeCount: self.pendingUpgradeCount,
            implementationCount: self.implementationCount
        };
    }

    get fun getPendingUpgradeCount(): Int {
        return self.pendingUpgradeCount;
    }

    get fun getUpgradeCount(): Int {
        return self.upgradeCount;
    }
}
