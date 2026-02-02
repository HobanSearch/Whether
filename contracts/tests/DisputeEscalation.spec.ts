import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { OracleResolver } from '../wrappers/OracleResolver';
import '@ton/test-utils';

describe('Dispute Escalation System', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let oracle: SandboxContract<OracleResolver>;
    let reporter1: SandboxContract<TreasuryContract>;
    let reporter2: SandboxContract<TreasuryContract>;
    let disputer: SandboxContract<TreasuryContract>;
    let arbitrator: SandboxContract<TreasuryContract>;

    const LOCATION_ID = 1001n;
    const DATE_KEY = BigInt(Math.floor(Date.now() / 1000 / 86400));

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        reporter1 = await blockchain.treasury('reporter1');
        reporter2 = await blockchain.treasury('reporter2');
        disputer = await blockchain.treasury('disputer');
        arbitrator = await blockchain.treasury('arbitrator');

        // Deploy OracleResolver
        oracle = blockchain.openContract(await OracleResolver.fromInit(deployer.address));
        await oracle.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            { $$type: 'Deploy', queryId: 0n }
        );

        // Add reporters
        await oracle.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'AddReporter',
                reporter: reporter1.address,
                name: "Reporter 1",
                sourceType: 0n
            }
        );

        await oracle.send(
            deployer.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'AddReporter',
                reporter: reporter2.address,
                name: "Reporter 2",
                sourceType: 0n
            }
        );
    });

    async function submitWeatherData() {
        // Submit weather data from both reporters to finalize
        const timestamp = DATE_KEY * 86400n;

        await oracle.send(
            reporter1.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'SubmitWeatherData',
                locationId: LOCATION_ID,
                timestamp: timestamp,
                temperature: 250n,       // 25.0°C
                temperatureMax: 280n,    // 28.0°C
                temperatureMin: 200n,    // 20.0°C
                precipitation: 0n,
                visibility: 10000n,
                windSpeed: 50n,
                windGust: 80n,
                pressure: 1013n,
                humidity: 60n,
                conditions: 0n,          // Clear
                sourceHash: 0n
            }
        );

        await oracle.send(
            reporter2.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'SubmitWeatherData',
                locationId: LOCATION_ID,
                timestamp: timestamp,
                temperature: 252n,       // 25.2°C (within tolerance)
                temperatureMax: 282n,
                temperatureMin: 198n,
                precipitation: 0n,
                visibility: 10200n,
                windSpeed: 52n,
                windGust: 85n,
                pressure: 1014n,
                humidity: 58n,
                conditions: 0n,
                sourceHash: 0n
            }
        );
    }

    describe('Arbitrator Management', () => {
        it('should add an arbitrator', async () => {
            const result = await oracle.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'AddArbitrator',
                    arbitrator: arbitrator.address,
                    name: "Chief Arbitrator",
                    weight: 100n  // Voting weight
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: oracle.address,
                success: true,
            });

            const arbInfo = await oracle.getGetArbitrator(arbitrator.address);
            expect(arbInfo).not.toBeNull();
            expect(arbInfo!.isActive).toBe(true);
            expect(arbInfo!.disputesResolved).toBe(0n);
        });

        it('should reject non-owner adding arbitrator', async () => {
            const result = await oracle.send(
                disputer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'AddArbitrator',
                    arbitrator: arbitrator.address,
                    name: "Unauthorized Arbitrator",
                    weight: 100n
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: disputer.address,
                to: oracle.address,
                success: false,
            });
        });

        it('should remove an arbitrator', async () => {
            // First add
            await oracle.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'AddArbitrator',
                    arbitrator: arbitrator.address,
                    name: "Arbitrator",
                    weight: 100n
                }
            );

            // Then remove
            const result = await oracle.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'RemoveArbitrator',
                    arbitrator: arbitrator.address
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: oracle.address,
                success: true,
            });

            const isArb = await oracle.getIsArbitrator(arbitrator.address);
            expect(isArb).toBe(false);
        });
    });

    describe('Dispute Creation', () => {
        beforeEach(async () => {
            await submitWeatherData();
        });

        it('should create a dispute with stake', async () => {
            const disputeStake = await oracle.getGetDisputeStake();

            const result = await oracle.send(
                disputer.getSender(),
                { value: disputeStake + toNano('0.1') },
                {
                    $$type: 'DisputeResolution',
                    locationId: LOCATION_ID,
                    date: DATE_KEY,
                    evidence: "Temperature was actually 30C according to local station"
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: disputer.address,
                to: oracle.address,
                success: true,
            });

            // Check dispute was created by retrieving dispute info (first dispute has ID 0)
            const dispute = await oracle.getGetDispute(0n);
            expect(dispute).not.toBeNull();
            expect(dispute!.status).toBe(0n); // Open
            expect(dispute!.disputer.toString()).toBe(disputer.address.toString());
        });

        it('should reject dispute with insufficient stake', async () => {
            const result = await oracle.send(
                disputer.getSender(),
                { value: toNano('1') }, // Less than 10 TON stake
                {
                    $$type: 'DisputeResolution',
                    locationId: LOCATION_ID,
                    date: DATE_KEY,
                    evidence: "Insufficient stake"
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: disputer.address,
                to: oracle.address,
                success: false,
            });
        });

        it('should reject duplicate dispute for same data', async () => {
            const disputeStake = await oracle.getGetDisputeStake();

            // First dispute
            await oracle.send(
                disputer.getSender(),
                { value: disputeStake + toNano('0.1') },
                {
                    $$type: 'DisputeResolution',
                    locationId: LOCATION_ID,
                    date: DATE_KEY,
                    evidence: "First dispute"
                }
            );

            // Second dispute (should fail)
            const result = await oracle.send(
                disputer.getSender(),
                { value: disputeStake + toNano('0.1') },
                {
                    $$type: 'DisputeResolution',
                    locationId: LOCATION_ID,
                    date: DATE_KEY,
                    evidence: "Duplicate dispute"
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: disputer.address,
                to: oracle.address,
                success: false,
            });
        });
    });

    describe('Dispute Escalation', () => {
        beforeEach(async () => {
            await submitWeatherData();

            // Create initial dispute
            const disputeStake = await oracle.getGetDisputeStake();
            await oracle.send(
                disputer.getSender(),
                { value: disputeStake + toNano('0.1') },
                {
                    $$type: 'DisputeResolution',
                    locationId: LOCATION_ID,
                    date: DATE_KEY,
                    evidence: "Initial dispute"
                }
            );
        });

        it('should escalate a dispute', async () => {
            const escalationStake = await oracle.getGetEscalationStake();

            const result = await oracle.send(
                disputer.getSender(),
                { value: escalationStake + toNano('0.1') },
                {
                    $$type: 'EscalateDispute',
                    disputeId: 0n,  // First dispute has ID 0
                    additionalEvidence: "Adding more evidence for escalation"
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: disputer.address,
                to: oracle.address,
                success: true,
            });

            // Check dispute status changed
            const dispute = await oracle.getGetDispute(0n);
            expect(dispute!.status).toBe(1n); // Escalated
        });

        it('should reject escalation from non-disputer', async () => {
            const escalationStake = await oracle.getGetEscalationStake();

            const result = await oracle.send(
                reporter1.getSender(), // Not the disputer
                { value: escalationStake + toNano('0.1') },
                {
                    $$type: 'EscalateDispute',
                    disputeId: 0n,  // First dispute has ID 0
                    additionalEvidence: "Unauthorized escalation"
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: reporter1.address,
                to: oracle.address,
                success: false,
            });
        });

        it('should reject escalation with insufficient stake', async () => {
            const result = await oracle.send(
                disputer.getSender(),
                { value: toNano('5') }, // Less than 25 TON escalation stake
                {
                    $$type: 'EscalateDispute',
                    disputeId: 0n,  // First dispute has ID 0
                    additionalEvidence: "Insufficient stake for escalation"
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: disputer.address,
                to: oracle.address,
                success: false,
            });
        });
    });

    describe('Dispute Resolution', () => {
        beforeEach(async () => {
            await submitWeatherData();

            // Create and escalate dispute
            const disputeStake = await oracle.getGetDisputeStake();
            await oracle.send(
                disputer.getSender(),
                { value: disputeStake + toNano('0.1') },
                {
                    $$type: 'DisputeResolution',
                    locationId: LOCATION_ID,
                    date: DATE_KEY,
                    evidence: "Initial dispute"
                }
            );

            const escalationStake = await oracle.getGetEscalationStake();
            await oracle.send(
                disputer.getSender(),
                { value: escalationStake + toNano('0.1') },
                {
                    $$type: 'EscalateDispute',
                    disputeId: 0n,  // First dispute has ID 0
                    additionalEvidence: "Escalated evidence"
                }
            );

            // Add arbitrator
            await oracle.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'AddArbitrator',
                    arbitrator: arbitrator.address,
                    name: "Chief Arbitrator",
                    weight: 100n  // Voting weight
                }
            );
        });

        it('should resolve dispute as upheld (refund stake)', async () => {
            const disputerBalanceBefore = await disputer.getBalance();

            // Arbitrator must vote first before resolving
            await oracle.send(
                arbitrator.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'ArbitratorVote',
                    disputeId: 0n,
                    upheld: true,  // Vote to uphold the dispute
                    reason: "Evidence supports the dispute"
                }
            );

            const result = await oracle.send(
                arbitrator.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'ResolveDispute',
                    disputeId: 0n,  // First dispute has ID 0
                    upheld: true,
                    newOutcome: true,
                    newValue: 300n, // Corrected value
                    reason: "Evidence verified, original data was incorrect"
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: arbitrator.address,
                to: oracle.address,
                success: true,
            });

            // Check stake was refunded to disputer
            expect(result.transactions).toHaveTransaction({
                from: oracle.address,
                to: disputer.address,
                success: true,
            });

            // Check dispute status
            const dispute = await oracle.getGetDispute(0n);
            expect(dispute!.status).toBe(2n); // Resolved (upheld)

            // Check arbitrator stats updated
            const arbInfo = await oracle.getGetArbitrator(arbitrator.address);
            expect(arbInfo!.disputesResolved).toBe(1n);
        });

        it('should resolve dispute as rejected (forfeit stake)', async () => {
            const deployerBalanceBefore = await deployer.getBalance();

            // Arbitrator must vote first before resolving
            await oracle.send(
                arbitrator.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'ArbitratorVote',
                    disputeId: 0n,
                    upheld: false,  // Vote to reject the dispute
                    reason: "Evidence is insufficient"
                }
            );

            const result = await oracle.send(
                arbitrator.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'ResolveDispute',
                    disputeId: 0n,  // First dispute has ID 0
                    upheld: false,
                    newOutcome: false,
                    newValue: 0n,
                    reason: "Evidence insufficient, original data correct"
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: arbitrator.address,
                to: oracle.address,
                success: true,
            });

            // Check stake was sent to owner (deployer/treasury)
            expect(result.transactions).toHaveTransaction({
                from: oracle.address,
                to: deployer.address,
                success: true,
            });

            // Check dispute status
            const dispute = await oracle.getGetDispute(0n);
            expect(dispute!.status).toBe(3n); // Rejected
        });

        it('should reject resolution from non-arbitrator', async () => {
            const result = await oracle.send(
                disputer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'ResolveDispute',
                    disputeId: 0n,  // First dispute has ID 0
                    upheld: true,
                    newOutcome: true,
                    newValue: 300n,
                    reason: "Unauthorized resolution attempt"
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: disputer.address,
                to: oracle.address,
                success: false,
            });
        });

        it('should reject resolution of non-escalated dispute', async () => {
            // Create new dispute without escalating
            const disputeStake = await oracle.getGetDisputeStake();

            // Use different date to avoid duplicate
            const newDate = DATE_KEY + 1n;

            // First submit weather data for the new date
            const timestamp = newDate * 86400n;
            await oracle.send(
                reporter1.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'SubmitWeatherData',
                    locationId: LOCATION_ID,
                    timestamp: timestamp,
                    temperature: 250n,
                    temperatureMax: 280n,
                    temperatureMin: 200n,
                    precipitation: 0n,
                    visibility: 10000n,
                    windSpeed: 50n,
                    windGust: 80n,
                    pressure: 1013n,
                    humidity: 60n,
                    conditions: 0n,
                    sourceHash: 0n
                }
            );
            await oracle.send(
                reporter2.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'SubmitWeatherData',
                    locationId: LOCATION_ID,
                    timestamp: timestamp,
                    temperature: 252n,
                    temperatureMax: 282n,
                    temperatureMin: 198n,
                    precipitation: 0n,
                    visibility: 10200n,
                    windSpeed: 52n,
                    windGust: 85n,
                    pressure: 1014n,
                    humidity: 58n,
                    conditions: 0n,
                    sourceHash: 0n
                }
            );

            // Create dispute but don't escalate
            await oracle.send(
                disputer.getSender(),
                { value: disputeStake + toNano('0.1') },
                {
                    $$type: 'DisputeResolution',
                    locationId: LOCATION_ID,
                    date: newDate,
                    evidence: "Non-escalated dispute"
                }
            );

            // Try to resolve (should fail - not escalated)
            const result = await oracle.send(
                arbitrator.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'ResolveDispute',
                    disputeId: 1n, // Second dispute has ID 1
                    upheld: true,
                    newOutcome: true,
                    newValue: 300n,
                    reason: "Cannot resolve non-escalated dispute"
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: arbitrator.address,
                to: oracle.address,
                success: false,
            });
        });
    });

    describe('Dispute Getters', () => {
        beforeEach(async () => {
            await submitWeatherData();

            const disputeStake = await oracle.getGetDisputeStake();
            await oracle.send(
                disputer.getSender(),
                { value: disputeStake + toNano('0.1') },
                {
                    $$type: 'DisputeResolution',
                    locationId: LOCATION_ID,
                    date: DATE_KEY,
                    evidence: "Test dispute"
                }
            );
        });

        it('should check if report has active dispute', async () => {
            const hasDispute = await oracle.getHasActiveDispute(LOCATION_ID, DATE_KEY);
            expect(hasDispute).toBe(true);
        });

        it('should get dispute by report', async () => {
            const dispute = await oracle.getGetDisputeByReport(LOCATION_ID, DATE_KEY);
            expect(dispute).not.toBeNull();
            expect(dispute!.locationId).toBe(LOCATION_ID);
        });

        it('should return stake amounts', async () => {
            const disputeStake = await oracle.getGetDisputeStake();
            const escalationStake = await oracle.getGetEscalationStake();

            expect(disputeStake).toBe(toNano('10'));
            expect(escalationStake).toBe(toNano('25'));
        });
    });
});
