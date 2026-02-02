import "@stdlib/deploy";
import "@stdlib/ownable";

// ============================================
// WHETHER LP TOKEN (TEP-74 Jetton)
// Represents liquidity provider shares in the pool
// ============================================

// ============================================
// TEP-74 JETTON STANDARD MESSAGES
// ============================================

message(0xf8a7ea5) JettonTransfer {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;
    responseDestination: Address;
    customPayload: Cell?;
    forwardTonAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

message(0x178d4519) JettonTransferNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    sender: Address;
    forwardPayload: Slice as remaining;
}

message(0x7362d09c) JettonBurn {
    queryId: Int as uint64;
    amount: Int as coins;
    responseDestination: Address;
    customPayload: Cell?;
}

message(0x595f07bc) JettonBurnNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    sender: Address;
    responseDestination: Address;
}

message(0xd53276db) Excesses {
    queryId: Int as uint64;
}

message(0x2c76b973) ProvideWalletAddress {
    queryId: Int as uint64;
    ownerAddress: Address;
    includeAddress: Bool;
}

message(0xd1735400) TakeWalletAddress {
    queryId: Int as uint64;
    walletAddress: Address;
    ownerAddress: Slice as remaining;
}

// Custom messages for LP pool integration
message MintLPTokens {
    queryId: Int as uint64;
    to: Address;
    amount: Int as coins;
}

message BurnLPTokens {
    queryId: Int as uint64;
    amount: Int as coins;
}

// ============================================
// JETTON MASTER DATA
// ============================================

struct JettonMasterData {
    totalSupply: Int;
    mintable: Bool;
    owner: Address;
    content: Cell;
    walletCode: Cell;
}

struct JettonWalletData {
    balance: Int;
    owner: Address;
    master: Address;
    walletCode: Cell;
}

// ============================================
// LP TOKEN MASTER CONTRACT
// ============================================

contract LPTokenMaster with Deployable, Ownable {
    totalSupply: Int as coins = 0;
    mintable: Bool = true;
    owner: Address;
    liquidityPool: Address;
    content: Cell;

    const MIN_STORAGE: Int = ton("0.01");
    const GAS_CONSUMPTION: Int = ton("0.01");

    init(owner: Address, liquidityPool: Address, content: Cell) {
        self.owner = owner;
        self.liquidityPool = liquidityPool;
        self.content = content;
    }

    // ============================================
    // MINTING (only from LiquidityPool)
    // ============================================

    receive(msg: MintLPTokens) {
        require(sender() == self.liquidityPool || sender() == self.owner, "Only pool can mint");
        require(self.mintable, "Minting disabled");

        self.totalSupply = self.totalSupply + msg.amount;

        // Deploy wallet if needed and credit tokens
        let walletInit: StateInit = self.getJettonWalletInit(msg.to);
        let walletAddress: Address = contractAddress(walletInit);

        send(SendParameters{
            to: walletAddress,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            code: walletInit.code,
            data: walletInit.data,
            body: JettonTransferNotification{
                queryId: msg.queryId,
                amount: msg.amount,
                sender: self.liquidityPool,
                forwardPayload: emptySlice()
            }.toCell()
        });
    }

    // ============================================
    // BURN NOTIFICATION (from wallets)
    // ============================================

    receive(msg: JettonBurnNotification) {
        let walletInit: StateInit = self.getJettonWalletInit(msg.sender);
        let walletAddress: Address = contractAddress(walletInit);
        require(sender() == walletAddress, "Invalid burn notification sender");

        self.totalSupply = self.totalSupply - msg.amount;

        // Notify liquidity pool about the burn for withdrawal
        send(SendParameters{
            to: self.liquidityPool,
            value: 0,
            mode: SendRemainingValue,
            body: beginCell()
                .storeUint(0x7bdd97de, 32)  // op::burn_notification
                .storeUint(msg.queryId, 64)
                .storeCoins(msg.amount)
                .storeAddress(msg.sender)
                .storeAddress(msg.responseDestination)
                .endCell()
        });
    }

    // ============================================
    // WALLET ADDRESS DISCOVERY
    // ============================================

    receive(msg: ProvideWalletAddress) {
        let walletInit: StateInit = self.getJettonWalletInit(msg.ownerAddress);
        let walletAddress: Address = contractAddress(walletInit);

        let body: Cell = TakeWalletAddress{
            queryId: msg.queryId,
            walletAddress: walletAddress,
            ownerAddress: msg.includeAddress
                ? beginCell().storeAddress(msg.ownerAddress).asSlice()
                : emptySlice()
        }.toCell();

        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingValue + SendIgnoreErrors,
            body: body
        });
    }

    // ============================================
    // ADMIN
    // ============================================

    receive("disable_minting") {
        require(sender() == self.owner, "Only owner");
        self.mintable = false;
    }

    receive("update_content") {
        require(sender() == self.owner, "Only owner");
        // Content update would come in body
    }

    // ============================================
    // INTERNAL HELPERS
    // ============================================

    fun getJettonWalletInit(owner: Address): StateInit {
        return initOf LPTokenWallet(owner, myAddress());
    }

    // ============================================
    // VIEW FUNCTIONS (TEP-74)
    // ============================================

    get fun get_jetton_data(): JettonMasterData {
        return JettonMasterData{
            totalSupply: self.totalSupply,
            mintable: self.mintable,
            owner: self.owner,
            content: self.content,
            walletCode: initOf LPTokenWallet(myAddress(), myAddress()).code
        };
    }

    get fun get_wallet_address(owner: Address): Address {
        return contractAddress(self.getJettonWalletInit(owner));
    }

    get fun getTotalSupply(): Int {
        return self.totalSupply;
    }

    get fun getLiquidityPool(): Address {
        return self.liquidityPool;
    }
}

// ============================================
// LP TOKEN WALLET CONTRACT
// ============================================

contract LPTokenWallet {
    balance: Int as coins = 0;
    owner: Address;
    master: Address;

    const MIN_STORAGE: Int = ton("0.01");
    const GAS_CONSUMPTION: Int = ton("0.01");

    init(owner: Address, master: Address) {
        self.owner = owner;
        self.master = master;
    }

    // ============================================
    // RECEIVE TOKENS
    // ============================================

    receive(msg: JettonTransferNotification) {
        require(sender() == self.master, "Only master can notify");
        self.balance = self.balance + msg.amount;
    }

    // ============================================
    // TRANSFER
    // ============================================

    receive(msg: JettonTransfer) {
        require(sender() == self.owner, "Only owner can transfer");
        require(self.balance >= msg.amount, "Insufficient balance");

        self.balance = self.balance - msg.amount;

        // Get destination wallet
        let destWalletInit: StateInit = initOf LPTokenWallet(msg.destination, self.master);
        let destWallet: Address = contractAddress(destWalletInit);

        // Forward to destination
        send(SendParameters{
            to: destWallet,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            code: destWalletInit.code,
            data: destWalletInit.data,
            body: JettonTransferNotification{
                queryId: msg.queryId,
                amount: msg.amount,
                sender: self.owner,
                forwardPayload: msg.forwardPayload
            }.toCell()
        });

        // Notify response destination if requested
        if (msg.responseDestination != newAddress(0, 0) && msg.forwardTonAmount > 0) {
            send(SendParameters{
                to: msg.responseDestination,
                value: msg.forwardTonAmount,
                mode: SendPayGasSeparately + SendIgnoreErrors,
                body: Excesses{queryId: msg.queryId}.toCell()
            });
        }
    }

    // ============================================
    // BURN (for withdrawal)
    // ============================================

    receive(msg: JettonBurn) {
        require(sender() == self.owner, "Only owner can burn");
        require(self.balance >= msg.amount, "Insufficient balance");

        self.balance = self.balance - msg.amount;

        // Notify master about burn
        send(SendParameters{
            to: self.master,
            value: 0,
            mode: SendRemainingValue,
            body: JettonBurnNotification{
                queryId: msg.queryId,
                amount: msg.amount,
                sender: self.owner,
                responseDestination: msg.responseDestination
            }.toCell()
        });
    }

    // ============================================
    // VIEW FUNCTIONS (TEP-74)
    // ============================================

    get fun get_wallet_data(): JettonWalletData {
        return JettonWalletData{
            balance: self.balance,
            owner: self.owner,
            master: self.master,
            walletCode: initOf LPTokenWallet(self.owner, self.master).code
        };
    }

    get fun getBalance(): Int {
        return self.balance;
    }

    get fun getOwner(): Address {
        return self.owner;
    }

    get fun getMaster(): Address {
        return self.master;
    }
}
