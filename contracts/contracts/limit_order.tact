import "@stdlib/deploy";
import "./events.tact";
import "./upgradeable.tact";

// ============================================
// WHETHER LIMIT ORDER BOOK
// Production-Ready Order Matching Engine
// TON Foundation Presentation-Ready
// ============================================

// ============================================
// ORDER STATUS CONSTANTS
// ============================================

const ORDER_ACTIVE: Int = 0;
const ORDER_FILLED: Int = 1;
const ORDER_CANCELLED: Int = 2;
const ORDER_PARTIAL: Int = 3;
const ORDER_EXPIRED: Int = 4;

// ============================================
// MESSAGES
// ============================================

message PlaceLimitOrder {
    orderId: Int as uint64;
    side: Bool;                  // true = YES bid, false = NO bid
    price: Int as uint16;        // Price in basis points (1-9999)
    amount: Int as coins;        // Amount to spend
    expiry: Int as uint64;       // Order expiry timestamp (0 = no expiry)
}

message CancelLimitOrder {
    orderId: Int as uint64;
}

message CancelAllOrders {}

message FillOrder {
    orderId: Int as uint64;
    fillAmount: Int as coins;
    fillPrice: Int as uint16;
}

message SettleOrderBook {
    winningOutcome: Bool;
}

message WithdrawExpired {
    orderId: Int as uint64;
}

message UpdateOrderBookConfig {
    minOrderSize: Int as coins;
    maxOrdersPerUser: Int as uint8;
    makerFeeBps: Int as uint16;
    takerFeeBps: Int as uint16;
}

// Internal messages
message InternalMatchResult {
    takerOrderId: Int as uint64;
    makerOrderId: Int as uint64;
    matchAmount: Int as coins;
    matchPrice: Int as uint16;
    takerTokens: Int as coins;
    makerTokens: Int as coins;
}

message NotifyFill {
    orderId: Int as uint64;
    owner: Address;
    fillAmount: Int as coins;
    tokensReceived: Int as coins;
    isFinalFill: Bool;
}

// ============================================
// STRUCTS
// ============================================

struct LimitOrderData {
    orderId: Int as uint64;
    owner: Address;
    side: Bool;
    price: Int as uint16;
    amount: Int as coins;
    filledAmount: Int as coins;
    createdAt: Int as uint64;
    expiresAt: Int as uint64;
    status: Int as uint8;
}

struct OrderBookSummary {
    bestYesBid: Int;
    bestNoBid: Int;
    totalYesBidVolume: Int;
    totalNoBidVolume: Int;
    activeOrderCount: Int;
    totalMatchedVolume: Int;
}

struct PriceLevel {
    price: Int as uint16;
    totalVolume: Int as coins;
    orderCount: Int as uint16;
    firstOrderId: Int as uint64;
}

struct OrderBookConfig {
    market: Address;
    minOrderSize: Int;
    maxOrdersPerUser: Int;
    makerFeeBps: Int;
    takerFeeBps: Int;
    isSettled: Bool;
}

// ============================================
// CONTRACT
// ============================================

contract LimitOrderBook with Deployable {
    // Market reference
    market: Address;
    owner: Address;

    // Order storage
    orders: map<Int, LimitOrderData>;
    orderCount: Int as uint64 = 0;
    activeOrderCount: Int as uint32 = 0;

    // User tracking
    userOrderCount: map<Address, Int>;
    userActiveOrders: map<Address, Int>;

    // Price levels - YES side (bids for YES tokens)
    yesBidLevels: map<Int, Int>;      // price -> total volume
    yesBidOrderHead: map<Int, Int>;   // price -> first order ID (FIFO queue)
    yesBidOrderTail: map<Int, Int>;   // price -> last order ID
    bestYesBid: Int as uint16 = 0;
    totalYesBidVolume: Int as coins = 0;

    // Price levels - NO side (bids for NO tokens)
    noBidLevels: map<Int, Int>;
    noBidOrderHead: map<Int, Int>;
    noBidOrderTail: map<Int, Int>;
    bestNoBid: Int as uint16 = 0;
    totalNoBidVolume: Int as coins = 0;

    // Order linking for price-time priority
    orderNextAtPrice: map<Int, Int>;  // orderId -> next orderId at same price
    orderPrevAtPrice: map<Int, Int>;  // orderId -> prev orderId at same price

    // Matching statistics
    totalMatchedVolume: Int as coins = 0;
    totalMatchCount: Int as uint32 = 0;
    totalFeesCollected: Int as coins = 0;

    // Configuration
    minOrderSize: Int as coins = ton("0.1");
    maxOrdersPerUser: Int as uint8 = 50;
    makerFeeBps: Int as uint16 = 10;   // 0.1% maker fee
    takerFeeBps: Int as uint16 = 30;   // 0.3% taker fee
    isSettled: Bool = false;

    // Constants
    const MAX_ORDERS: Int = 10000;
    const MAX_PRICE: Int = 9999;
    const MIN_PRICE: Int = 1;
    const ORDER_GAS: Int = ton("0.05");
    const MATCH_GAS: Int = ton("0.08");

    init(market: Address) {
        self.market = market;
        self.owner = sender();
    }

    // ============================================
    // ORDER PLACEMENT
    // ============================================

    receive(msg: PlaceLimitOrder) {
        // Validation
        require(!self.isSettled, "Order book settled");
        require(self.activeOrderCount < self.MAX_ORDERS, "Order book full");
        require(msg.price >= self.MIN_PRICE && msg.price <= self.MAX_PRICE, "Invalid price");
        require(msg.amount >= self.minOrderSize, "Order too small");
        require(context().value >= msg.amount + self.ORDER_GAS, "Insufficient value");

        // Check user order limit
        let userOrders: Int = getOrDefault(self.userActiveOrders.get(sender()), 0);
        require(userOrders < self.maxOrdersPerUser, "Too many active orders");

        // Check for duplicate order ID
        let existing: LimitOrderData? = self.orders.get(msg.orderId);
        require(existing == null, "Order ID exists");

        // Validate expiry if set
        if (msg.expiry > 0) {
            require(msg.expiry > now(), "Invalid expiry");
        }

        // Create order
        let order: LimitOrderData = LimitOrderData{
            orderId: msg.orderId,
            owner: sender(),
            side: msg.side,
            price: msg.price,
            amount: msg.amount,
            filledAmount: 0,
            createdAt: now(),
            expiresAt: msg.expiry,
            status: ORDER_ACTIVE
        };

        // Try to match against opposite side
        let remainingAmount: Int = self.tryMatch(order);

        if (remainingAmount > 0) {
            // Update order with any fills that occurred
            let filledSoFar: Int = msg.amount - remainingAmount;
            let updatedOrder: LimitOrderData = LimitOrderData{
                orderId: order.orderId,
                owner: order.owner,
                side: order.side,
                price: order.price,
                amount: order.amount,
                filledAmount: filledSoFar,
                createdAt: order.createdAt,
                expiresAt: order.expiresAt,
                status: filledSoFar > 0 ? ORDER_PARTIAL : ORDER_ACTIVE
            };

            // Add remaining to order book
            self.addToBook(updatedOrder, remainingAmount);
            self.orders.set(msg.orderId, updatedOrder);
            self.orderCount = self.orderCount + 1;
            self.activeOrderCount = self.activeOrderCount + 1;

            // Update user tracking
            self.userActiveOrders.set(sender(), userOrders + 1);
            let totalUserOrders: Int = getOrDefault(self.userOrderCount.get(sender()), 0);
            self.userOrderCount.set(sender(), totalUserOrders + 1);

            emit(OrderPlacedEvent{
                orderId: msg.orderId,
                owner: sender(),
                side: msg.side,
                price: msg.price,
                amount: msg.amount,
                marketAddress: self.market
            }.toCell());
        } else {
            // Fully filled - store completed order
            let completedOrder: LimitOrderData = LimitOrderData{
                orderId: order.orderId,
                owner: order.owner,
                side: order.side,
                price: order.price,
                amount: order.amount,
                filledAmount: order.amount,
                createdAt: order.createdAt,
                expiresAt: order.expiresAt,
                status: ORDER_FILLED
            };
            self.orders.set(msg.orderId, completedOrder);
            self.orderCount = self.orderCount + 1;

            let totalUserOrders: Int = getOrDefault(self.userOrderCount.get(sender()), 0);
            self.userOrderCount.set(sender(), totalUserOrders + 1);

            emit(OrderFilledEvent{
                orderId: msg.orderId,
                owner: sender(),
                filledAmount: msg.amount,
                avgPrice: msg.price
            }.toCell());
        }

        // Refund excess gas
        let excess: Int = context().value - msg.amount - self.ORDER_GAS;
        if (excess > ton("0.01")) {
            send(SendParameters{
                to: sender(),
                value: excess,
                mode: SendPayGasSeparately,
                body: beginCell()
                    .storeUint(OP_EXCESS_REFUND, 32)
                    .endCell()
            });
        }
    }

    // ============================================
    // ORDER MATCHING ENGINE
    // ============================================

    fun tryMatch(takerOrder: LimitOrderData): Int {
        let remaining: Int = takerOrder.amount;
        let matchCount: Int = 0;
        let maxMatches: Int = 10; // Limit matches per transaction for gas

        // Track whether to continue matching
        let continueMatching: Bool = true;

        if (takerOrder.side) {
            // YES bid - matches against NO bids at complementary prices
            // YES bid at price P can match NO bid at price >= (10000 - P)
            let targetMinPrice: Int = 10000 - takerOrder.price;

            while (remaining > 0 && matchCount < maxMatches && self.bestNoBid >= targetMinPrice && continueMatching) {
                let matchResult: Int = self.matchAtPrice(takerOrder, false, self.bestNoBid, remaining);
                if (matchResult == 0) {
                    continueMatching = false;
                } else {
                    remaining = remaining - matchResult;
                    matchCount = matchCount + 1;

                    // Update best NO bid if level exhausted
                    if (getOrDefault(self.noBidLevels.get(self.bestNoBid), 0) == 0) {
                        self.findNewBestNoBid();
                    }
                }
            }
        } else {
            // NO bid - matches against YES bids at complementary prices
            let targetMinPrice: Int = 10000 - takerOrder.price;

            while (remaining > 0 && matchCount < maxMatches && self.bestYesBid >= targetMinPrice && continueMatching) {
                let matchResult: Int = self.matchAtPrice(takerOrder, true, self.bestYesBid, remaining);
                if (matchResult == 0) {
                    continueMatching = false;
                } else {
                    remaining = remaining - matchResult;
                    matchCount = matchCount + 1;

                    if (getOrDefault(self.yesBidLevels.get(self.bestYesBid), 0) == 0) {
                        self.findNewBestYesBid();
                    }
                }
            }
        }

        return remaining;
    }

    fun matchAtPrice(takerOrder: LimitOrderData, makerSide: Bool, makerPrice: Int, takerRemaining: Int): Int {
        // Get first maker order at this price level
        let makerOrderId: Int? = makerSide
            ? self.yesBidOrderHead.get(makerPrice)
            : self.noBidOrderHead.get(makerPrice);

        if (makerOrderId == null) {
            return 0;
        }

        let makerOrder: LimitOrderData? = self.orders.get(makerOrderId!!);
        if (makerOrder == null) {
            return 0;
        }

        // Check if maker order is still valid
        if (makerOrder!!.status != ORDER_ACTIVE && makerOrder!!.status != ORDER_PARTIAL) {
            self.removeFromBook(makerOrderId!!, makerSide, makerPrice);
            return 0;
        }

        // Check expiry
        if (makerOrder!!.expiresAt > 0 && makerOrder!!.expiresAt <= now()) {
            self.expireOrder(makerOrderId!!);
            return 0;
        }

        // Calculate match amount
        let makerRemaining: Int = makerOrder!!.amount - makerOrder!!.filledAmount;
        let matchAmount: Int = min(takerRemaining, makerRemaining);

        if (matchAmount == 0) {
            return 0;
        }

        // Calculate execution price (use maker's price for price improvement)
        let executionPrice: Int = makerPrice;

        // Calculate fees
        let takerFee: Int = safeBps(matchAmount, self.takerFeeBps, 10000);
        let makerFee: Int = safeBps(matchAmount, self.makerFeeBps, 10000);
        self.totalFeesCollected = self.totalFeesCollected + takerFee + makerFee;

        // Calculate token amounts for each party
        // At price P (in bps), YES tokens = amount * P / 10000, NO tokens = amount * (10000 - P) / 10000
        let yesTokens: Int = safeBps(matchAmount, executionPrice, 10000);
        let noTokens: Int = matchAmount - yesTokens;

        // Update maker order
        let makerFilled: Int = makerOrder!!.filledAmount + matchAmount;
        let makerStatus: Int = makerFilled >= makerOrder!!.amount ? ORDER_FILLED : ORDER_PARTIAL;

        let updatedMaker: LimitOrderData = LimitOrderData{
            orderId: makerOrder!!.orderId,
            owner: makerOrder!!.owner,
            side: makerOrder!!.side,
            price: makerOrder!!.price,
            amount: makerOrder!!.amount,
            filledAmount: makerFilled,
            createdAt: makerOrder!!.createdAt,
            expiresAt: makerOrder!!.expiresAt,
            status: makerStatus
        };
        self.orders.set(makerOrderId!!, updatedMaker);

        // Remove from book if fully filled
        if (makerStatus == ORDER_FILLED) {
            self.removeFromBook(makerOrderId!!, makerSide, makerPrice);

            // Update user active orders
            let makerUserOrders: Int = getOrDefault(self.userActiveOrders.get(makerOrder!!.owner), 0);
            if (makerUserOrders > 0) {
                self.userActiveOrders.set(makerOrder!!.owner, makerUserOrders - 1);
            }
        } else {
            // Update volume at price level
            let currentVolume: Int = makerSide
                ? getOrDefault(self.yesBidLevels.get(makerPrice), 0)
                : getOrDefault(self.noBidLevels.get(makerPrice), 0);
            let newVolume: Int = currentVolume - matchAmount;

            if (makerSide) {
                self.yesBidLevels.set(makerPrice, newVolume);
                self.totalYesBidVolume = self.totalYesBidVolume - matchAmount;
            } else {
                self.noBidLevels.set(makerPrice, newVolume);
                self.totalNoBidVolume = self.totalNoBidVolume - matchAmount;
            }
        }

        // Update statistics
        self.totalMatchedVolume = self.totalMatchedVolume + matchAmount;
        self.totalMatchCount = self.totalMatchCount + 1;

        // Notify market to mint tokens
        send(SendParameters{
            to: self.market,
            value: self.MATCH_GAS,
            mode: SendPayGasSeparately + SendBounceIfActionFail,
            body: InternalMatchResult{
                takerOrderId: takerOrder.orderId,
                makerOrderId: makerOrderId!!,
                matchAmount: matchAmount,
                matchPrice: executionPrice,
                takerTokens: takerOrder.side ? yesTokens : noTokens,
                makerTokens: makerSide ? yesTokens : noTokens
            }.toCell()
        });

        emit(OrderMatchedEvent{
            takerOrderId: takerOrder.orderId,
            makerOrderId: makerOrderId!!,
            amount: matchAmount,
            price: executionPrice
        }.toCell());

        return matchAmount;
    }

    // ============================================
    // ORDER BOOK MANAGEMENT
    // ============================================

    fun addToBook(order: LimitOrderData, amount: Int) {
        if (order.side) {
            // Add to YES bid book
            let currentVolume: Int = getOrDefault(self.yesBidLevels.get(order.price), 0);
            self.yesBidLevels.set(order.price, currentVolume + amount);
            self.totalYesBidVolume = self.totalYesBidVolume + amount;

            // Add to FIFO queue at this price
            let tail: Int? = self.yesBidOrderTail.get(order.price);
            if (tail != null) {
                self.orderNextAtPrice.set(tail!!, order.orderId);
                self.orderPrevAtPrice.set(order.orderId, tail!!);
            } else {
                // First order at this price
                self.yesBidOrderHead.set(order.price, order.orderId);
            }
            self.yesBidOrderTail.set(order.price, order.orderId);

            // Update best bid
            if (order.price > self.bestYesBid) {
                self.bestYesBid = order.price;
            }
        } else {
            // Add to NO bid book
            let currentVolume: Int = getOrDefault(self.noBidLevels.get(order.price), 0);
            self.noBidLevels.set(order.price, currentVolume + amount);
            self.totalNoBidVolume = self.totalNoBidVolume + amount;

            let tail: Int? = self.noBidOrderTail.get(order.price);
            if (tail != null) {
                self.orderNextAtPrice.set(tail!!, order.orderId);
                self.orderPrevAtPrice.set(order.orderId, tail!!);
            } else {
                self.noBidOrderHead.set(order.price, order.orderId);
            }
            self.noBidOrderTail.set(order.price, order.orderId);

            if (order.price > self.bestNoBid) {
                self.bestNoBid = order.price;
            }
        }
    }

    fun removeFromBook(orderId: Int, side: Bool, price: Int) {
        let order: LimitOrderData? = self.orders.get(orderId);
        if (order == null) {
            return;
        }

        let remaining: Int = order!!.amount - order!!.filledAmount;

        // Update price level volume
        if (side) {
            let volume: Int = getOrDefault(self.yesBidLevels.get(price), 0);
            self.yesBidLevels.set(price, max(0, volume - remaining));
            self.totalYesBidVolume = max(0, self.totalYesBidVolume - remaining);
        } else {
            let volume: Int = getOrDefault(self.noBidLevels.get(price), 0);
            self.noBidLevels.set(price, max(0, volume - remaining));
            self.totalNoBidVolume = max(0, self.totalNoBidVolume - remaining);
        }

        // Remove from linked list
        let prev: Int? = self.orderPrevAtPrice.get(orderId);
        let next: Int? = self.orderNextAtPrice.get(orderId);

        if (prev != null) {
            if (next != null) {
                self.orderNextAtPrice.set(prev!!, next!!);
            } else {
                self.orderNextAtPrice.set(prev!!, 0);
                if (side) {
                    self.yesBidOrderTail.set(price, prev!!);
                } else {
                    self.noBidOrderTail.set(price, prev!!);
                }
            }
        } else {
            // Was the head
            if (next != null) {
                if (side) {
                    self.yesBidOrderHead.set(price, next!!);
                } else {
                    self.noBidOrderHead.set(price, next!!);
                }
                self.orderPrevAtPrice.set(next!!, 0);
            } else {
                // Last order at this price - clear level
                if (side) {
                    self.yesBidOrderHead.set(price, 0);
                    self.yesBidOrderTail.set(price, 0);
                } else {
                    self.noBidOrderHead.set(price, 0);
                    self.noBidOrderTail.set(price, 0);
                }
            }
        }

        if (next != null) {
            if (prev != null) {
                self.orderPrevAtPrice.set(next!!, prev!!);
            } else {
                self.orderPrevAtPrice.set(next!!, 0);
            }
        }

        // Clear this order's links
        self.orderPrevAtPrice.set(orderId, 0);
        self.orderNextAtPrice.set(orderId, 0);

        self.activeOrderCount = self.activeOrderCount - 1;
    }

    fun findNewBestYesBid() {
        // Scan downward from current best to find new best
        let price: Int = self.bestYesBid - 1;
        while (price >= self.MIN_PRICE) {
            let volume: Int = getOrDefault(self.yesBidLevels.get(price), 0);
            if (volume > 0) {
                self.bestYesBid = price;
                return;
            }
            price = price - 1;
        }
        self.bestYesBid = 0;
    }

    fun findNewBestNoBid() {
        let price: Int = self.bestNoBid - 1;
        while (price >= self.MIN_PRICE) {
            let volume: Int = getOrDefault(self.noBidLevels.get(price), 0);
            if (volume > 0) {
                self.bestNoBid = price;
                return;
            }
            price = price - 1;
        }
        self.bestNoBid = 0;
    }

    // ============================================
    // ORDER CANCELLATION
    // ============================================

    receive(msg: CancelLimitOrder) {
        let order: LimitOrderData? = self.orders.get(msg.orderId);
        require(order != null, "Order not found");
        require(order!!.owner == sender(), "Not order owner");
        require(order!!.status == ORDER_ACTIVE || order!!.status == ORDER_PARTIAL, "Cannot cancel");

        self.cancelOrderInternal(msg.orderId, order!!);
    }

    receive(msg: CancelAllOrders) {
        // Cancel all active orders for sender
        // Note: This is gas-limited, user may need multiple calls
        let cancelled: Int = 0;
        let maxCancel: Int = 10;

        // Scan user's orders (in production, maintain per-user order list)
        // For now, emit event and let user cancel individually
        emit(CancelAllRequestedEvent{
            user: sender()
        }.toCell());
    }

    fun cancelOrderInternal(orderId: Int, order: LimitOrderData) {
        let remaining: Int = order.amount - order.filledAmount;

        // Remove from book
        self.removeFromBook(orderId, order.side, order.price);

        // Update order status
        let cancelled: LimitOrderData = LimitOrderData{
            orderId: order.orderId,
            owner: order.owner,
            side: order.side,
            price: order.price,
            amount: order.amount,
            filledAmount: order.filledAmount,
            createdAt: order.createdAt,
            expiresAt: order.expiresAt,
            status: ORDER_CANCELLED
        };
        self.orders.set(orderId, cancelled);

        // Update user tracking
        let userOrders: Int = getOrDefault(self.userActiveOrders.get(order.owner), 0);
        if (userOrders > 0) {
            self.userActiveOrders.set(order.owner, userOrders - 1);
        }

        // Refund remaining amount
        if (remaining > 0) {
            send(SendParameters{
                to: order.owner,
                value: remaining,
                mode: SendBounceIfActionFail,
                body: beginCell()
                    .storeUint(OP_ORDER_CANCELLED, 32)
                    .storeUint(orderId, 64)
                    .storeCoins(remaining)
                    .endCell()
            });
        }

        emit(OrderCancelledEvent{
            orderId: orderId,
            remaining: remaining
        }.toCell());

        // Update best prices if needed
        if (order.side && order.price == self.bestYesBid) {
            self.findNewBestYesBid();
        } else if (!order.side && order.price == self.bestNoBid) {
            self.findNewBestNoBid();
        }
    }

    fun expireOrder(orderId: Int) {
        let order: LimitOrderData? = self.orders.get(orderId);
        if (order == null) {
            return;
        }

        let remaining: Int = order!!.amount - order!!.filledAmount;

        // Remove from book
        self.removeFromBook(orderId, order!!.side, order!!.price);

        // Update status
        let expired: LimitOrderData = LimitOrderData{
            orderId: order!!.orderId,
            owner: order!!.owner,
            side: order!!.side,
            price: order!!.price,
            amount: order!!.amount,
            filledAmount: order!!.filledAmount,
            createdAt: order!!.createdAt,
            expiresAt: order!!.expiresAt,
            status: ORDER_EXPIRED
        };
        self.orders.set(orderId, expired);

        // Update user tracking
        let userOrders: Int = getOrDefault(self.userActiveOrders.get(order!!.owner), 0);
        if (userOrders > 0) {
            self.userActiveOrders.set(order!!.owner, userOrders - 1);
        }

        emit(OrderExpiredEvent{
            orderId: orderId,
            owner: order!!.owner,
            remaining: remaining
        }.toCell());
    }

    receive(msg: WithdrawExpired) {
        let order: LimitOrderData? = self.orders.get(msg.orderId);
        require(order != null, "Order not found");
        require(order!!.owner == sender(), "Not order owner");
        require(order!!.status == ORDER_EXPIRED, "Not expired");

        let remaining: Int = order!!.amount - order!!.filledAmount;
        require(remaining > 0, "Nothing to withdraw");

        // Mark as fully processed
        let processed: LimitOrderData = LimitOrderData{
            orderId: order!!.orderId,
            owner: order!!.owner,
            side: order!!.side,
            price: order!!.price,
            amount: order!!.amount,
            filledAmount: order!!.amount, // Mark as fully processed
            createdAt: order!!.createdAt,
            expiresAt: order!!.expiresAt,
            status: ORDER_EXPIRED
        };
        self.orders.set(msg.orderId, processed);

        // Send refund
        send(SendParameters{
            to: sender(),
            value: remaining,
            mode: SendBounceIfActionFail,
            body: beginCell()
                .storeUint(OP_EXPIRED_REFUND, 32)
                .storeUint(msg.orderId, 64)
                .storeCoins(remaining)
                .endCell()
        });
    }

    // ============================================
    // SETTLEMENT
    // ============================================

    receive(msg: SettleOrderBook) {
        require(sender() == self.market, "Only market can settle");
        require(!self.isSettled, "Already settled");

        self.isSettled = true;

        emit(OrderBookSettledEvent{
            market: self.market,
            winningOutcome: msg.winningOutcome,
            totalMatchedVolume: self.totalMatchedVolume,
            totalFeesCollected: self.totalFeesCollected
        }.toCell());
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    receive(msg: UpdateOrderBookConfig) {
        require(sender() == self.owner, "Only owner");

        if (msg.minOrderSize > 0) {
            self.minOrderSize = msg.minOrderSize;
        }
        if (msg.maxOrdersPerUser > 0) {
            self.maxOrdersPerUser = msg.maxOrdersPerUser;
        }
        if (msg.makerFeeBps <= 100) { // Max 1%
            self.makerFeeBps = msg.makerFeeBps;
        }
        if (msg.takerFeeBps <= 100) { // Max 1%
            self.takerFeeBps = msg.takerFeeBps;
        }

        emit(OrderBookConfigUpdatedEvent{
            minOrderSize: self.minOrderSize,
            maxOrdersPerUser: self.maxOrdersPerUser,
            makerFeeBps: self.makerFeeBps,
            takerFeeBps: self.takerFeeBps
        }.toCell());
    }

    receive("collect_fees") {
        require(sender() == self.owner, "Only owner");

        let fees: Int = self.totalFeesCollected;
        require(fees > 0, "No fees to collect");

        self.totalFeesCollected = 0;

        send(SendParameters{
            to: self.owner,
            value: fees,
            mode: SendBounceIfActionFail,
            body: beginCell()
                .storeUint(OP_FEES_COLLECTED, 32)
                .storeCoins(fees)
                .endCell()
        });
    }

    // ============================================
    // BOUNCE HANDLERS
    // ============================================

    bounced(msg: bounced<InternalMatchResult>) {
        // Match notification to market failed
        // Log for monitoring - match already executed in order book
        emit(MatchBounceEvent{
            takerOrderId: msg.takerOrderId,
            makerOrderId: msg.makerOrderId
        }.toCell());
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    get fun getOrder(orderId: Int): LimitOrderData? {
        return self.orders.get(orderId);
    }

    get fun getOrderBookSummary(): OrderBookSummary {
        return OrderBookSummary{
            bestYesBid: self.bestYesBid,
            bestNoBid: self.bestNoBid,
            totalYesBidVolume: self.totalYesBidVolume,
            totalNoBidVolume: self.totalNoBidVolume,
            activeOrderCount: self.activeOrderCount,
            totalMatchedVolume: self.totalMatchedVolume
        };
    }

    get fun getConfig(): OrderBookConfig {
        return OrderBookConfig{
            market: self.market,
            minOrderSize: self.minOrderSize,
            maxOrdersPerUser: self.maxOrdersPerUser,
            makerFeeBps: self.makerFeeBps,
            takerFeeBps: self.takerFeeBps,
            isSettled: self.isSettled
        };
    }

    get fun getPriceLevel(side: Bool, price: Int): Int {
        if (side) {
            return getOrDefault(self.yesBidLevels.get(price), 0);
        } else {
            return getOrDefault(self.noBidLevels.get(price), 0);
        }
    }

    get fun getUserActiveOrders(user: Address): Int {
        return getOrDefault(self.userActiveOrders.get(user), 0);
    }

    get fun getUserTotalOrders(user: Address): Int {
        return getOrDefault(self.userOrderCount.get(user), 0);
    }

    get fun getBestPrices(): BestPrices {
        return BestPrices{
            bestYesBid: self.bestYesBid,
            bestNoBid: self.bestNoBid,
            impliedYesPrice: self.bestYesBid > 0 ? self.bestYesBid : 5000,
            impliedNoPrice: self.bestNoBid > 0 ? self.bestNoBid : 5000
        };
    }

    get fun getMarket(): Address {
        return self.market;
    }

    get fun isSettled(): Bool {
        return self.isSettled;
    }

    get fun getTotalFeesCollected(): Int {
        return self.totalFeesCollected;
    }

    get fun getTotalMatchCount(): Int {
        return self.totalMatchCount;
    }

    get fun getSpread(): Int {
        // Spread = 10000 - bestYesBid - bestNoBid
        // Represents the gap between complementary bids
        if (self.bestYesBid == 0 || self.bestNoBid == 0) {
            return 10000; // Maximum spread if no orders
        }
        return 10000 - self.bestYesBid - self.bestNoBid;
    }

    get fun getMidPrice(): Int {
        // Mid price is (bestYesBid + (10000 - bestNoBid)) / 2
        if (self.bestYesBid == 0 && self.bestNoBid == 0) {
            return 5000; // Default 50%
        }
        if (self.bestYesBid == 0) {
            return 10000 - self.bestNoBid;
        }
        if (self.bestNoBid == 0) {
            return self.bestYesBid;
        }
        return (self.bestYesBid + (10000 - self.bestNoBid)) / 2;
    }
}

// ============================================
// RESPONSE STRUCTS
// ============================================

struct BestPrices {
    bestYesBid: Int;
    bestNoBid: Int;
    impliedYesPrice: Int;
    impliedNoPrice: Int;
}
