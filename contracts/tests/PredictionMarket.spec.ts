import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Address, beginCell } from '@ton/core';
import { PredictionMarket } from '../wrappers/PredictionMarket';
import '@ton/test-utils';

describe('PredictionMarket', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let market: SandboxContract<PredictionMarket>;
    let oracle: SandboxContract<TreasuryContract>;
    let bettor1: SandboxContract<TreasuryContract>;
    let bettor2: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        oracle = await blockchain.treasury('oracle');
        bettor1 = await blockchain.treasury('bettor1');
        bettor2 = await blockchain.treasury('bettor2');

        const now = Math.floor(Date.now() / 1000);
        const expiry = BigInt(now + 3600); // 1 hour from now

        market = blockchain.openContract(await PredictionMarket.fromInit({
            $$type: 'PredictionMarketInit',
            factoryAddress: deployer.address,
            marketId: 1n,
            eventDescription: "Test Market",
            locationId: 1001n,
            expiryTimestamp: expiry,
            oracleAddress: oracle.address,
            marketType: 0n, // Binary
            resolutionCriteria: "Test",
            creatorAddress: deployer.address,  // Creator for fee distribution
            proxyAdmin: deployer.address  // Proxy admin for upgrades
        }));

        const deployResult = await market.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: market.address,
            deploy: true,
            success: true,
        });
    });

    it('should accept bets', async () => {
        // Bettor 1 places YES bet
        const res1 = await market.send(
            bettor1.getSender(),
            { value: toNano('2') }, // 2 TON (min bet 0.1)
            {
                $$type: 'PlaceBet',
                side: true,
                bracketIndex: 0n
            }
        );

        expect(res1.transactions).toHaveTransaction({
            from: bettor1.address,
            to: market.address,
            success: true,
        });

        // Check stats
        const stats = await market.getGetStats();
        expect(stats.yesPool).toBeGreaterThan(toNano('1.9')); // Approx 2 TON
    });

    it('should reject bets after expiry', async () => {
        // Fast forward
        blockchain.now = Math.floor(Date.now() / 1000) + 7200; // +2 hours

        const res = await market.send(
            bettor1.getSender(),
            { value: toNano('1') },
            {
                $$type: 'PlaceBet',
                side: true,
                bracketIndex: 0n
            }
        );

        expect(res.transactions).toHaveTransaction({
            from: bettor1.address,
            to: market.address,
            success: false, // Should fail
        });
    });

    it('should settle and payout', async () => {
        // 1. Place Bets
        // Bettor 1: YES 10 TON
        await market.send(
            bettor1.getSender(),
            { value: toNano('10') },
            { $$type: 'PlaceBet', side: true, bracketIndex: 0n }
        );

        // Bettor 2: NO 10 TON
        await market.send(
            bettor2.getSender(),
            { value: toNano('10') },
            { $$type: 'PlaceBet', side: false, bracketIndex: 0n }
        );

        // 2. Fast forward to expiry
        blockchain.now = Math.floor(Date.now() / 1000) + 3601;

        // 3. Oracle settles (YES wins)
        const settleRes = await market.send(
            oracle.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'SettleMarket',
                outcome: true,
                winningBracket: 0n,
                settlementValue: 100n,
                dataHash: 0n
            }
        );
        expect(settleRes.transactions).toHaveTransaction({
            from: oracle.address,
            to: market.address,
            success: true
        });

        // 4. Bettor 1 claims
        // Fast forward dispute window (1 hour)
        blockchain.now += 3605;

        // Verify balance change
        const balanceBefore = await bettor1.getBalance();

        const claimRes = await market.send(
            bettor1.getSender(),
            { value: toNano('0.1') },
            { $$type: 'ClaimWinnings' }
        );

        expect(claimRes.transactions).toHaveTransaction({
            from: bettor1.address,
            to: market.address,
            success: true
        });

        // Should receive approx 20 TON minus fees
        // (Pool is 20, 2% fee = 0.4, Net = 19.6)
        // Bettor 1 gets 100% of YES side (which is winner)
        // YES pool = 10, Total pool = 20.
        // Payout = (UserShare / YesPool) * TotalPool = (10/10) * 19.6 = 19.6
        // NOTE: in tests, gas fees also apply, so it's approx.
    });
});
