import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Address, beginCell } from '@ton/core';
import { OracleResolver } from '../wrappers/OracleResolver';
import { PredictionMarket } from '../wrappers/PredictionMarket';
import '@ton/test-utils';

describe('OracleResolver', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let resolver: SandboxContract<OracleResolver>;
    let reporter1: SandboxContract<TreasuryContract>;
    let reporter2: SandboxContract<TreasuryContract>;
    let reporter3: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        reporter1 = await blockchain.treasury('reporter1');
        reporter2 = await blockchain.treasury('reporter2');
        reporter3 = await blockchain.treasury('reporter3');

        resolver = blockchain.openContract(await OracleResolver.fromInit(deployer.address));

        const deployResult = await resolver.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: resolver.address,
            deploy: true,
            success: true,
        });
    });

    it('should allow owner to add reporters', async () => {
        const res = await resolver.send(
            deployer.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'AddReporter',
                reporter: reporter1.address,
                name: "Reporter 1",
                sourceType: 0n
            }
        );

        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: resolver.address,
            success: true,
        });

        // Verify state (cannot directly read maps, but can check events or methods if available)
        // Since getReporter is available:
        const reporterInfo = await resolver.getGetReporter(reporter1.address);
        expect(reporterInfo).toBeDefined();
        expect(reporterInfo!.name).toBe("Reporter 1");
    });

    it('should aggregate weather data and finalize', async () => {
        // Add reporters
        await resolver.send(deployer.getSender(), { value: toNano('0.1') }, { $$type: 'AddReporter', reporter: reporter1.address, name: "R1", sourceType: 0n });
        await resolver.send(deployer.getSender(), { value: toNano('0.1') }, { $$type: 'AddReporter', reporter: reporter2.address, name: "R2", sourceType: 0n });

        const now = Math.floor(Date.now() / 1000);
        const locationId = 1001n;

        // R1 submits
        await resolver.send(
            reporter1.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'SubmitWeatherData',
                locationId: locationId,
                timestamp: BigInt(now),
                temperature: 250n, // 25.0 C
                temperatureMax: 300n,
                temperatureMin: 200n,
                precipitation: 0n,
                visibility: 10000n,
                windSpeed: 50n,
                windGust: 80n,
                pressure: 1013n,
                humidity: 50n,
                conditions: 0n,
                sourceHash: 123n
            }
        );

        // R2 submits matching data
        const res = await resolver.send(
            reporter2.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'SubmitWeatherData',
                locationId: locationId,
                timestamp: BigInt(now),
                temperature: 252n, // 25.2 C (within tolerance)
                temperatureMax: 300n,
                temperatureMin: 200n,
                precipitation: 0n,
                visibility: 10000n,
                windSpeed: 50n,
                windGust: 80n,
                pressure: 1013n,
                humidity: 50n,
                conditions: 0n,
                sourceHash: 456n
            }
        );

        expect(res.transactions).toHaveTransaction({
            from: reporter2.address,
            to: resolver.address,
            success: true,
        });

        // Check if finalized
        const dateKey = BigInt(Math.floor(now / 86400));
        const finalized = await resolver.getIsFinalized(locationId, dateKey);
        expect(finalized).toBe(true);
    });

    it('should not finalize if data exceeds tolerance', async () => {
        // Add reporters
        await resolver.send(deployer.getSender(), { value: toNano('0.1') }, { $$type: 'AddReporter', reporter: reporter1.address, name: "R1", sourceType: 0n });
        await resolver.send(deployer.getSender(), { value: toNano('0.1') }, { $$type: 'AddReporter', reporter: reporter2.address, name: "R2", sourceType: 0n });

        const now = Math.floor(Date.now() / 1000);
        const locationId = 2001n; // Different location

        // R1 submits
        await resolver.send(
            reporter1.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'SubmitWeatherData',
                locationId: locationId,
                timestamp: BigInt(now),
                temperature: 250n, // 25.0 C
                // ... fill other fields
                temperatureMax: 300n, temperatureMin: 200n, precipitation: 0n, visibility: 10000n, windSpeed: 50n, windGust: 80n, pressure: 1013n, humidity: 50n, conditions: 0n, sourceHash: 123n
            }
        );

        // R2 submits conflicting data (30.0 C)
        await resolver.send(
            reporter2.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'SubmitWeatherData',
                locationId: locationId,
                timestamp: BigInt(now),
                temperature: 300n, // 30.0 C (Diff 5.0 > 1.0 tolerance)
                // ... fill other fields
                temperatureMax: 300n, temperatureMin: 200n, precipitation: 0n, visibility: 10000n, windSpeed: 50n, windGust: 80n, pressure: 1013n, humidity: 50n, conditions: 0n, sourceHash: 456n
            }
        );

        const dateKey = BigInt(Math.floor(now / 86400));
        const finalized = await resolver.getIsFinalized(locationId, dateKey);
        expect(finalized).toBe(false);
    });
});
