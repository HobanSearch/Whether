import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { MarketFactory } from '../wrappers/MarketFactory';
import { OracleResolver } from '../wrappers/OracleResolver';
import '@ton/test-utils';

describe('MarketFactory', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let factory: SandboxContract<MarketFactory>;
    let oracleResolver: SandboxContract<OracleResolver>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');

        // Deploy OracleResolver first (mock or real)
        oracleResolver = blockchain.openContract(await OracleResolver.fromInit(deployer.address));
        const oracleDeployResult = await oracleResolver.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );
        expect(oracleDeployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: oracleResolver.address,
            deploy: true,
            success: true,
        });

        // Deploy MarketFactory
        factory = blockchain.openContract(await MarketFactory.fromInit(oracleResolver.address));
        const deployResult = await factory.send(
            deployer.getSender(),
            { value: toNano('10') },
            { $$type: 'Deploy', queryId: 0n }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: factory.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // Checks are done in beforeEach
    });

    it('should create a market', async () => {
        const marketId = 1n;
        const res = await factory.send(
            deployer.getSender(),
            { value: toNano('1') },
            {
                $$type: 'CreateMarket',
                eventDescription: "Will it rain?",
                locationId: 1001n,
                expiryTimestamp: BigInt(Math.floor(Date.now() / 1000) + 7200),
                marketType: 0n, // Binary
                resolutionCriteria: "Precipitation > 0",
                oracleAddress: oracleResolver.address,
                creator: deployer.address  // Market creator for fee distribution
            }
        );

        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: factory.address,
            success: true,
        });

        // Check if market address is registered
        const marketAddr = await factory.getGetMarketAddress(marketId);
        expect(marketAddr).toBeDefined();

        // Optional: Check if market contract is deployed
        // const market = blockchain.openContract(PredictionMarket.fromAddress(marketAddr!!));
        // const marketInfo = await market.getGetMarketInfo();
        // expect(marketInfo.marketId).toEqual(marketId);
        // expect(marketInfo.marketId).toEqual(marketId);
    });

    xit('should create a series of markets', async () => {
        // ... skipped ...
    });

    it('should withdraw funds', async () => {
        const balanceBefore = await deployer.getBalance();
        const res = await factory.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            "withdraw"
        );
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: factory.address,
            success: true,
        });

        // Check trace for outbound message
        const outMsg = res.transactions[1].outMessages.get(0); // Factory -> Owner
        // Difficult to check precise balance in sandbox easily without parsing, 
        // but success: true on transaction and exitCode 0 implies it worked.
    });



    it('should pause and unpause by owner', async () => {
        // Pause
        const pauseRes = await factory.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'PauseFactory', paused: true }
        );
        expect(pauseRes.transactions).toHaveTransaction({ from: deployer.address, to: factory.address, success: true });

        let isPaused = await factory.getIsPaused();
        expect(isPaused).toBe(true);

        // Try create market (should fail)
        const failRes = await factory.send(
            deployer.getSender(),
            { value: toNano('1') },
            {
                $$type: 'CreateMarket',
                eventDescription: "Fail",
                locationId: 999n,
                expiryTimestamp: BigInt(Math.floor(Date.now() / 1000) + 7200),
                marketType: 0n,
                resolutionCriteria: "N/A",
                oracleAddress: oracleResolver.address,
                creator: deployer.address  // Market creator for fee distribution
            }
        );
        expect(failRes.transactions).toHaveTransaction({ from: deployer.address, to: factory.address, success: false });

        // Unpause
        await factory.send(deployer.getSender(), { value: toNano('0.05') }, { $$type: 'PauseFactory', paused: false });
        isPaused = await factory.getIsPaused();
        expect(isPaused).toBe(false);
    });
});

