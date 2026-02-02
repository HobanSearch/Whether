import "@stdlib/deploy";
import "./events.tact";

// ============================================
// WHETHER MULTI-SIGNATURE WALLET
// Production-ready multi-sig governance contract
// For critical protocol operations
// ============================================

// ============================================
// MESSAGES
// ============================================

message SubmitTransaction {
    to: Address;
    value: Int as coins;
    body: Cell;
    description: String;
}

message ConfirmTransaction {
    txId: Int as uint64;
}

message RevokeConfirmation {
    txId: Int as uint64;
}

message ExecuteTransaction {
    txId: Int as uint64;
}

message AddOwner {
    owner: Address;
}

message RemoveOwner {
    owner: Address;
}

message ChangeRequirement {
    required: Int as uint8;
}

message ReplaceOwner {
    oldOwner: Address;
    newOwner: Address;
}

// ============================================
// STRUCTS
// ============================================

struct Transaction {
    to: Address;
    value: Int as coins;
    body: Cell;
    description: String;
    executed: Bool;
    cancelled: Bool;
    confirmationCount: Int as uint8;
    submittedAt: Int as uint64;
    submittedBy: Address;
    executedAt: Int as uint64;
}

struct MultiSigConfig {
    ownerCount: Int;
    required: Int;
    transactionCount: Int;
    pendingCount: Int;
}

// ============================================
// CONTRACT
// ============================================

contract MultiSigWallet with Deployable {
    // Owner management
    owners: map<Address, Bool>;
    ownerCount: Int as uint8 = 0;
    required: Int as uint8;

    // Transaction management
    transactions: map<Int, Transaction>;
    confirmations: map<Int, map<Address, Bool>>;
    transactionCount: Int as uint64 = 0;
    pendingTransactions: Int as uint32 = 0;

    // Configuration
    const MAX_OWNERS: Int = 10;
    const MIN_REQUIRED: Int = 1;
    const MAX_PENDING_TX: Int = 50;
    const TX_EXPIRY: Int = 604800; // 7 days

    init(owners: map<Address, Bool>, ownerCount: Int, required: Int) {
        require(ownerCount >= required, "Invalid requirement");
        require(required >= self.MIN_REQUIRED, "Requirement too low");
        require(ownerCount <= self.MAX_OWNERS, "Too many owners");

        self.owners = owners;
        self.ownerCount = ownerCount;
        self.required = required;
    }

    // ============================================
    // TRANSACTION SUBMISSION
    // ============================================

    receive(msg: SubmitTransaction) {
        self.requireOwner();
        require(self.pendingTransactions < self.MAX_PENDING_TX, "Too many pending transactions");

        let txId: Int = self.transactionCount;
        self.transactionCount = self.transactionCount + 1;
        self.pendingTransactions = self.pendingTransactions + 1;

        // Create transaction
        self.transactions.set(txId, Transaction{
            to: msg.to,
            value: msg.value,
            body: msg.body,
            description: msg.description,
            executed: false,
            cancelled: false,
            confirmationCount: 1, // Auto-confirm by submitter
            submittedAt: now(),
            submittedBy: sender(),
            executedAt: 0
        });

        // Auto-confirm by submitter
        let confirms: map<Address, Bool> = emptyMap();
        confirms.set(sender(), true);
        self.confirmations.set(txId, confirms);

        emit(TransactionSubmittedEvent{
            txId: txId,
            to: msg.to,
            value: msg.value,
            submitter: sender(),
            description: msg.description
        }.toCell());

        // If single owner or already has enough confirmations, execute immediately
        if (self.required == 1) {
            self.executeTransactionInternal(txId);
        }
    }

    // ============================================
    // CONFIRMATION MANAGEMENT
    // ============================================

    receive(msg: ConfirmTransaction) {
        self.requireOwner();

        let tx: Transaction? = self.transactions.get(msg.txId);
        require(tx != null, "Transaction not found");
        require(!tx!!.executed, "Already executed");
        require(!tx!!.cancelled, "Transaction cancelled");
        require(now() < tx!!.submittedAt + self.TX_EXPIRY, "Transaction expired");

        let confirms: map<Address, Bool>? = self.confirmations.get(msg.txId);
        require(confirms != null, "Invalid state");
        require(confirms!!.get(sender()) != true, "Already confirmed");

        // Add confirmation
        confirms!!.set(sender(), true);
        self.confirmations.set(msg.txId, confirms!!);

        // Update transaction confirmation count
        let updatedTx: Transaction = Transaction{
            to: tx!!.to,
            value: tx!!.value,
            body: tx!!.body,
            description: tx!!.description,
            executed: tx!!.executed,
            cancelled: tx!!.cancelled,
            confirmationCount: tx!!.confirmationCount + 1,
            submittedAt: tx!!.submittedAt,
            submittedBy: tx!!.submittedBy,
            executedAt: tx!!.executedAt
        };
        self.transactions.set(msg.txId, updatedTx);

        emit(TransactionConfirmedEvent{
            txId: msg.txId,
            confirmer: sender(),
            confirmationCount: updatedTx.confirmationCount
        }.toCell());

        // Auto-execute if threshold reached
        if (updatedTx.confirmationCount >= self.required) {
            self.executeTransactionInternal(msg.txId);
        }
    }

    receive(msg: RevokeConfirmation) {
        self.requireOwner();

        let tx: Transaction? = self.transactions.get(msg.txId);
        require(tx != null, "Transaction not found");
        require(!tx!!.executed, "Already executed");
        require(!tx!!.cancelled, "Transaction cancelled");

        let confirms: map<Address, Bool>? = self.confirmations.get(msg.txId);
        require(confirms != null, "Invalid state");
        require(confirms!!.get(sender()) == true, "Not confirmed");

        // Remove confirmation
        confirms!!.set(sender(), null);
        self.confirmations.set(msg.txId, confirms!!);

        // Update confirmation count
        let updatedTx: Transaction = Transaction{
            to: tx!!.to,
            value: tx!!.value,
            body: tx!!.body,
            description: tx!!.description,
            executed: tx!!.executed,
            cancelled: tx!!.cancelled,
            confirmationCount: tx!!.confirmationCount - 1,
            submittedAt: tx!!.submittedAt,
            submittedBy: tx!!.submittedBy,
            executedAt: tx!!.executedAt
        };
        self.transactions.set(msg.txId, updatedTx);

        emit(ConfirmationRevokedEvent{
            txId: msg.txId,
            revoker: sender()
        }.toCell());
    }

    // ============================================
    // TRANSACTION EXECUTION
    // ============================================

    receive(msg: ExecuteTransaction) {
        self.requireOwner();
        self.executeTransactionInternal(msg.txId);
    }

    fun executeTransactionInternal(txId: Int) {
        let tx: Transaction? = self.transactions.get(txId);
        require(tx != null, "Transaction not found");
        require(!tx!!.executed, "Already executed");
        require(!tx!!.cancelled, "Transaction cancelled");
        require(tx!!.confirmationCount >= self.required, "Insufficient confirmations");

        // Mark as executed BEFORE sending (reentrancy protection)
        let executedTx: Transaction = Transaction{
            to: tx!!.to,
            value: tx!!.value,
            body: tx!!.body,
            description: tx!!.description,
            executed: true,
            cancelled: false,
            confirmationCount: tx!!.confirmationCount,
            submittedAt: tx!!.submittedAt,
            submittedBy: tx!!.submittedBy,
            executedAt: now()
        };
        self.transactions.set(txId, executedTx);
        self.pendingTransactions = self.pendingTransactions - 1;

        // Execute the transaction
        send(SendParameters{
            to: tx!!.to,
            value: tx!!.value,
            mode: SendPayGasSeparately + SendBounceIfActionFail,
            body: tx!!.body
        });

        emit(TransactionExecutedEvent{
            txId: txId,
            executor: sender(),
            success: true
        }.toCell());
    }

    // ============================================
    // OWNER MANAGEMENT (Self-referential calls)
    // ============================================

    receive(msg: AddOwner) {
        require(sender() == myAddress(), "Internal only");
        require(self.owners.get(msg.owner) != true, "Already owner");
        require(self.ownerCount < self.MAX_OWNERS, "Max owners");

        self.owners.set(msg.owner, true);
        self.ownerCount = self.ownerCount + 1;

        emit(OwnerAddedEvent{
            owner: msg.owner,
            addedBy: myAddress()
        }.toCell());
    }

    receive(msg: RemoveOwner) {
        require(sender() == myAddress(), "Internal only");
        require(self.owners.get(msg.owner) == true, "Not owner");
        require(self.ownerCount > self.required, "Would break quorum");

        self.owners.set(msg.owner, null);
        self.ownerCount = self.ownerCount - 1;

        emit(OwnerRemovedEvent{
            owner: msg.owner,
            removedBy: myAddress()
        }.toCell());
    }

    receive(msg: ChangeRequirement) {
        require(sender() == myAddress(), "Internal only");
        require(msg.required >= self.MIN_REQUIRED, "Below minimum");
        require(msg.required <= self.ownerCount, "Exceeds owner count");

        let oldRequired: Int = self.required;
        self.required = msg.required;

        emit(RequirementChangedEvent{
            oldRequired: oldRequired,
            newRequired: msg.required
        }.toCell());
    }

    receive(msg: ReplaceOwner) {
        require(sender() == myAddress(), "Internal only");
        require(self.owners.get(msg.oldOwner) == true, "Old owner not found");
        require(self.owners.get(msg.newOwner) != true, "New owner already exists");

        self.owners.set(msg.oldOwner, null);
        self.owners.set(msg.newOwner, true);

        emit(OwnerRemovedEvent{
            owner: msg.oldOwner,
            removedBy: myAddress()
        }.toCell());

        emit(OwnerAddedEvent{
            owner: msg.newOwner,
            addedBy: myAddress()
        }.toCell());
    }

    // ============================================
    // BOUNCE HANDLER
    // ============================================

    bounced(src: bounced<SubmitTransaction>) {
        // Transaction submission bounced - shouldn't happen normally
        // Log for debugging
    }

    // ============================================
    // INTERNAL HELPERS
    // ============================================

    fun requireOwner() {
        require(self.owners.get(sender()) == true, "Not an owner");
    }

    // ============================================
    // GETTERS
    // ============================================

    get fun getTransaction(txId: Int): Transaction? {
        return self.transactions.get(txId);
    }

    get fun isConfirmed(txId: Int): Bool {
        let tx: Transaction? = self.transactions.get(txId);
        if (tx == null) {
            return false;
        }
        return tx!!.confirmationCount >= self.required;
    }

    get fun getConfirmationCount(txId: Int): Int {
        let tx: Transaction? = self.transactions.get(txId);
        if (tx == null) {
            return 0;
        }
        return tx!!.confirmationCount;
    }

    get fun hasConfirmed(txId: Int, owner: Address): Bool {
        let confirms: map<Address, Bool>? = self.confirmations.get(txId);
        if (confirms == null) {
            return false;
        }
        return confirms!!.get(owner) == true;
    }

    get fun getOwnerCount(): Int {
        return self.ownerCount;
    }

    get fun getRequired(): Int {
        return self.required;
    }

    get fun isOwner(addr: Address): Bool {
        return self.owners.get(addr) == true;
    }

    get fun getTransactionCount(): Int {
        return self.transactionCount;
    }

    get fun getPendingTransactionCount(): Int {
        return self.pendingTransactions;
    }

    get fun getConfig(): MultiSigConfig {
        return MultiSigConfig{
            ownerCount: self.ownerCount,
            required: self.required,
            transactionCount: self.transactionCount,
            pendingCount: self.pendingTransactions
        };
    }

    get fun isTransactionExpired(txId: Int): Bool {
        let tx: Transaction? = self.transactions.get(txId);
        if (tx == null) {
            return true;
        }
        return now() >= tx!!.submittedAt + self.TX_EXPIRY;
    }
}
