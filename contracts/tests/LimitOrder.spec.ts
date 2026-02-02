import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Address, beginCell } from '@ton/core';
import { PredictionMarket } from '../wrappers/PredictionMarket';
import { PositionMinter, PositionWallet } from '../wrappers/PositionMinter';
import '@ton/test-utils';

describe('Limit Order Book', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let market: SandboxContract<PredictionMarket>;
    let oracle: SandboxContract<TreasuryContract>;
    let trader1: SandboxContract<TreasuryContract>;
    let trader2: SandboxContract<TreasuryContract>;
    let yesMinter: SandboxContract<PositionMinter>;
    let noMinter: SandboxContract<PositionMinter>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        oracle = await blockchain.treasury('oracle');
        trader1 = await blockchain.treasury('trader1');
        trader2 = await blockchain.treasury('trader2');

        const now = Math.floor(Date.now() / 1000);
        const expiry = BigInt(now + 3600); // 1 hour from now

        // Deploy market
        market = blockchain.openContract(await PredictionMarket.fromInit({
            $$type: 'PredictionMarketInit',
            factoryAddress: deployer.address,
            marketId: 1n,
            eventDescription: "Test Limit Order Market",
            locationId: 1001n,
            expiryTimestamp: expiry,
            oracleAddress: oracle.address,
            marketType: 0n, // Binary
            resolutionCriteria: "Test",
            creatorAddress: deployer.address,
            proxyAdmin: deployer.address  // Proxy admin for upgrades
        }));

        await market.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            { $$type: 'Deploy', queryId: 0n }
        );

        // Initialize position minters (required for limit orders)
        await market.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            { $$type: 'InitPositionMinters' }
        );

        const yesMinterAddr = await market.getGetYesMinterAddress();
        const noMinterAddr = await market.getGetNoMinterAddress();
        yesMinter = blockchain.openContract(PositionMinter.fromAddress(yesMinterAddr!));
        noMinter = blockchain.openContract(PositionMinter.fromAddress(noMinterAddr!));
    });

    describe('PlaceLimitOrder', () => {
        it('should place a YES limit order', async () => {
            const result = await market.send(
                trader1.getSender(),
                { value: toNano('1.1') }, // 1 TON order + gas
                {
                    $$type: 'PlaceLimitOrder',
                    orderId: 1n,
                    side: true, // YES
                    price: 6000n, // 60% price (0.6 TON per token)
                    amount: toNano('1'),
                    expiry: BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hour expiry
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: trader1.address,
                to: market.address,
                success: true,
            });

            // Check order book state
            const orderBook = await market.getGetOrderBook();
            expect(orderBook.bestYesBid).toBeGreaterThan(0n);
            expect(orderBook.activeOrderCount).toBe(1n);
        });

        it('should place a NO limit order', async () => {
            const result = await market.send(
                trader2.getSender(),
                { value: toNano('1.1') },
                {
                    $$type: 'PlaceLimitOrder',
                    orderId: 2n,
                    side: false, // NO
                    price: 4000n, // 40% price
                    amount: toNano('1'),
                    expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: trader2.address,
                to: market.address,
                success: true,
            });

            // Check order book state
            const orderBook = await market.getGetOrderBook();
            expect(orderBook.bestNoBid).toBeGreaterThan(0n);
        });

        it('should reject order with invalid price', async () => {
            // Price must be between 1 and 9999 bps
            const result = await market.send(
                trader1.getSender(),
                { value: toNano('1.1') },
                {
                    $$type: 'PlaceLimitOrder',
                    orderId: 3n,
                    side: true,
                    price: 10000n, // 100% - invalid
                    amount: toNano('1'),
                    expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: trader1.address,
                to: market.address,
                success: false, // Should fail
            });
        });

        it('should reject order below minimum amount', async () => {
            const result = await market.send(
                trader1.getSender(),
                { value: toNano('0.08') }, // Below MIN_BET (0.1 TON)
                {
                    $$type: 'PlaceLimitOrder',
                    orderId: 4n,
                    side: true,
                    price: 5000n,
                    amount: toNano('0.05'),
                    expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: trader1.address,
                to: market.address,
                success: false,
            });
        });
    });

    describe('CancelLimitOrder', () => {
        it('should cancel an order and refund', async () => {
            // First place an order
            await market.send(
                trader1.getSender(),
                { value: toNano('2.1') },
                {
                    $$type: 'PlaceLimitOrder',
                    orderId: 1n,
                    side: true,
                    price: 6000n,
                    amount: toNano('2'),
                    expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
                }
            );

            // Get balance before cancel
            const balanceBefore = await trader1.getBalance();

            // Cancel the order
            const cancelResult = await market.send(
                trader1.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'CancelLimitOrder',
                    orderId: 1n
                }
            );

            expect(cancelResult.transactions).toHaveTransaction({
                from: trader1.address,
                to: market.address,
                success: true,
            });

            // Check refund was sent
            expect(cancelResult.transactions).toHaveTransaction({
                from: market.address,
                to: trader1.address,
                success: true,
            });

            // Verify order book is empty
            const orderBook = await market.getGetOrderBook();
            expect(orderBook.activeOrderCount).toBe(0n);
        });

        it('should reject cancel from non-owner', async () => {
            // Trader1 places order
            await market.send(
                trader1.getSender(),
                { value: toNano('1.1') },
                {
                    $$type: 'PlaceLimitOrder',
                    orderId: 1n,
                    side: true,
                    price: 6000n,
                    amount: toNano('1'),
                    expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
                }
            );

            // Trader2 tries to cancel (should fail)
            const cancelResult = await market.send(
                trader2.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'CancelLimitOrder',
                    orderId: 1n
                }
            );

            expect(cancelResult.transactions).toHaveTransaction({
                from: trader2.address,
                to: market.address,
                success: false, // Should fail - not owner
            });
        });
    });

    describe('Order Retrieval', () => {
        it('should return order info by ID', async () => {
            await market.send(
                trader1.getSender(),
                { value: toNano('1.1') },
                {
                    $$type: 'PlaceLimitOrder',
                    orderId: 1n,
                    side: true,
                    price: 5500n,
                    amount: toNano('1'),
                    expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
                }
            );

            const orderInfo = await market.getGetOrder(1n);
            expect(orderInfo).not.toBeNull();
            expect(orderInfo!.orderId).toBe(1n);
            expect(orderInfo!.side).toBe(true);
            expect(orderInfo!.price).toBe(5500n);
            expect(orderInfo!.status).toBe(0n); // Active
        });

        it('should return null for non-existent order', async () => {
            const orderInfo = await market.getGetOrder(999n);
            expect(orderInfo).toBeNull();
        });
    });

    describe('Order Book State', () => {
        it('should update best prices correctly', async () => {
            // Place first YES order at 5000
            await market.send(
                trader1.getSender(),
                { value: toNano('1.1') },
                {
                    $$type: 'PlaceLimitOrder',
                    orderId: 1n,
                    side: true,
                    price: 5000n,
                    amount: toNano('1'),
                    expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
                }
            );

            let orderBook = await market.getGetOrderBook();
            expect(orderBook.bestYesBid).toBe(5000n);

            // Place second YES order at 6000 (better price)
            await market.send(
                trader1.getSender(),
                { value: toNano('1.1') },
                {
                    $$type: 'PlaceLimitOrder',
                    orderId: 2n,
                    side: true,
                    price: 6000n,
                    amount: toNano('1'),
                    expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
                }
            );

            orderBook = await market.getGetOrderBook();
            expect(orderBook.bestYesBid).toBe(6000n); // Updated to better price
            expect(orderBook.activeOrderCount).toBe(2n);
        });

        it('should track total volume', async () => {
            await market.send(
                trader1.getSender(),
                { value: toNano('2.1') },
                {
                    $$type: 'PlaceLimitOrder',
                    orderId: 1n,
                    side: true,
                    price: 5000n,
                    amount: toNano('2'),
                    expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
                }
            );

            await market.send(
                trader2.getSender(),
                { value: toNano('3.1') },
                {
                    $$type: 'PlaceLimitOrder',
                    orderId: 2n,
                    side: false,
                    price: 5000n,
                    amount: toNano('3'),
                    expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
                }
            );

            const orderBook = await market.getGetOrderBook();
            expect(orderBook.totalYesBidVolume).toBeGreaterThan(0n);
            expect(orderBook.totalNoBidVolume).toBeGreaterThan(0n);
        });
    });

    describe('Market Restrictions', () => {
        it('should reject orders after market expiry', async () => {
            // Fast forward past expiry
            blockchain.now = Math.floor(Date.now() / 1000) + 3601;

            const result = await market.send(
                trader1.getSender(),
                { value: toNano('1.1') },
                {
                    $$type: 'PlaceLimitOrder',
                    orderId: 1n,
                    side: true,
                    price: 5000n,
                    amount: toNano('1'),
                    expiry: BigInt(Math.floor(Date.now() / 1000) + 7200) // Order expiry, but market is already expired
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: trader1.address,
                to: market.address,
                success: false, // Should fail - market expired
            });
        });

        it('should reject orders when market is paused', async () => {
            // Pause market
            await market.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                { $$type: 'EmergencyPause', paused: true }
            );

            const result = await market.send(
                trader1.getSender(),
                { value: toNano('1.1') },
                {
                    $$type: 'PlaceLimitOrder',
                    orderId: 1n,
                    side: true,
                    price: 5000n,
                    amount: toNano('1'),
                    expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: trader1.address,
                to: market.address,
                success: false, // Should fail - market paused
            });
        });
    });
});
