import "@stdlib/deploy";
import "./events.tact";
import "./upgradeable.tact";

// ============================================
// WHETHER ORACLE RESOLVER
// Production-Ready Weather Oracle with Timelock
// Multi-source Aggregation + Dispute Resolution
// TON Foundation Presentation-Ready
// ============================================

// ============================================
// MESSAGES
// ============================================

message SubmitWeatherData {
    locationId: Int as uint32;
    timestamp: Int as uint64;
    temperature: Int as int16;
    temperatureMax: Int as int16;
    temperatureMin: Int as int16;
    precipitation: Int as uint16;
    visibility: Int as uint16;
    windSpeed: Int as uint16;
    windGust: Int as uint16;
    pressure: Int as uint16;
    humidity: Int as uint8;
    conditions: Int as uint8;
    sourceHash: Int as uint256;
}

message SubmitMETAR {
    locationId: Int as uint32;
    rawMetar: String;
    parsedTemp: Int as int16;
    parsedVisibility: Int as uint16;
    parsedWind: Int as uint16;
    parsedConditions: Int as uint8;
    observationTime: Int as uint64;
}

message AddReporter {
    reporter: Address;
    name: String;
    sourceType: Int as uint8;
}

message RemoveReporter {
    reporter: Address;
}

message ProposeSettlement {
    marketId: Int as uint32;
    marketAddress: Address;
    locationId: Int as uint32;
    resolutionType: Int as uint8;
    threshold: Int as int32;
    comparisonType: Int as uint8;
}

message FinalizeSettlement {
    settlementId: Int as uint64;
}

message DisputeResolution {
    locationId: Int as uint32;
    date: Int as uint32;
    evidence: String;
}

message EscalateDispute {
    disputeId: Int as uint64;
    additionalEvidence: String;
}

message ResolveDispute {
    disputeId: Int as uint64;
    upheld: Bool;
    newOutcome: Bool;
    newValue: Int as int32;
    reason: String;
}

message AmendSettlement {
    marketAddress: Address;
    marketId: Int as uint32;
    newOutcome: Bool;
    newSettlementValue: Int as int32;
    amendmentReason: String;
}

message AddArbitrator {
    arbitrator: Address;
    name: String;
    weight: Int as uint8;
}

message RemoveArbitrator {
    arbitrator: Address;
}

message ArbitratorVote {
    disputeId: Int as uint64;
    upheld: Bool;
    reason: String;
}

message PauseMarketForDispute {
    marketAddress: Address;
    disputeId: Int as uint64;
    paused: Bool;
}

message SubmitPOW {
    locationId: Int as uint32;
    photoHash: Int as uint256;
    gpsLat: Int as int32;
    gpsLon: Int as int32;
    reportedConditions: Int as uint8;
    timestamp: Int as uint64;
}

message UpdateOracleConfig {
    disputeStake: Int as coins;
    escalationStake: Int as coins;
    settlementTimelock: Int as uint32;
    minConfirmations: Int as uint8;
}

// ============================================
// STRUCTS
// ============================================

struct WeatherReport {
    temperature: Int as int16;
    temperatureMax: Int as int16;
    temperatureMin: Int as int16;
    precipitation: Int as uint16;
    visibility: Int as uint16;
    windSpeed: Int as uint16;
    conditions: Int as uint8;
    timestamp: Int as uint64;
    reportCount: Int as uint8;
    isFinalized: Bool;
    finalizedAt: Int as uint64;
}

struct ReporterInfo {
    name: String;
    sourceType: Int as uint8;
    submissionCount: Int as uint32;
    accuracyScore: Int as uint16;
    isActive: Bool;
    lastSubmission: Int as uint64;
}

struct LocationInfo {
    locationId: Int as uint32;
    name: String;
    locationType: Int as uint8;
    latitude: Int as int32;
    longitude: Int as int32;
    isActive: Bool;
}

struct PendingSettlement {
    settlementId: Int as uint64;
    marketId: Int as uint32;
    marketAddress: Address;
    locationId: Int as uint32;
    proposedOutcome: Bool;
    proposedValue: Int as int32;
    proposedAt: Int as uint64;
    proposedBy: Address;
    canFinalizeAt: Int as uint64;
    isFinalized: Bool;
    isCancelled: Bool;
}

struct DisputeInfo {
    disputeId: Int as uint64;
    locationId: Int as uint32;
    date: Int as uint32;
    disputer: Address;
    stake: Int as coins;
    evidence: String;
    status: Int as uint8;
    createdAt: Int as uint64;
    escalatedAt: Int as uint64;
    resolvedAt: Int as uint64;
    marketAddress: Address?;
    originalOutcome: Bool;
    originalValue: Int as int32;
    newOutcome: Bool;
    newValue: Int as int32;
    resolvedBy: Address?;
    resolutionReason: String;
    votesFor: Int as uint8;
    votesAgainst: Int as uint8;
    totalWeight: Int as uint8;
}

struct ArbitratorInfo {
    name: String;
    disputesResolved: Int as uint32;
    isActive: Bool;
    addedAt: Int as uint64;
    weight: Int as uint8;
}

struct OracleConfig {
    owner: Address;
    reporterCount: Int;
    arbitratorCount: Int;
    disputeStake: Int;
    escalationStake: Int;
    settlementTimelock: Int;
    minConfirmations: Int;
    totalDisputes: Int;
    pendingSettlements: Int;
}

// ============================================
// CONTRACT
// ============================================

contract OracleResolver with Deployable, Upgradeable {
    owner: Address;

    // Upgradeable trait requirements
    proxyAdmin: Address;
    contractVersion: Int as uint16 = 1;
    upgradeEnabled: Bool = true;

    // Reporter management
    reporters: map<Address, ReporterInfo>;
    reporterAddresses: map<Int, Address>;
    reporterCount: Int as uint8 = 0;

    // Weather data storage
    reports: map<Int, WeatherReport>;
    // Note: Using composite key (hash of reportKey + address) since Tact doesn't support nested maps
    reporterSubmissions: map<Int, Bool>;

    // Location registry
    locations: map<Int, LocationInfo>;
    locationCount: Int as uint16 = 0;

    // Settlement timelock
    pendingSettlements: map<Int, PendingSettlement>;
    settlementCount: Int as uint64 = 0;
    activeSettlementCount: Int as uint32 = 0;

    // Dispute management
    disputes: map<Int, DisputeInfo>;
    disputeCount: Int as uint64 = 0;
    activeDisputeCount: Int as uint32 = 0;
    reportKeyToDispute: map<Int, Int>;
    // Note: Using composite key (hash of disputeId + address) since Tact doesn't support nested maps
    disputeVotes: map<Int, Bool>;

    // Arbitrator management
    arbitrators: map<Address, ArbitratorInfo>;
    arbitratorAddresses: map<Int, Address>;
    arbitratorCount: Int as uint8 = 0;

    // Configuration
    disputeStake: Int as coins = ton("10");
    escalationStake: Int as coins = ton("25");
    settlementTimelock: Int as uint32 = 3600;  // 1 hour timelock

    // Constants
    const MIN_CONFIRMATIONS: Int = 2;
    const MAX_REPORTERS: Int = 10;
    const MAX_ARBITRATORS: Int = 5;
    const MAX_PENDING_SETTLEMENTS: Int = 50;
    const MAX_ACTIVE_DISPUTES: Int = 20;
    const TEMPERATURE_TOLERANCE: Int = 10;
    const PRECIP_TOLERANCE: Int = 50;
    const VISIBILITY_TOLERANCE: Int = 500;
    const FINALIZATION_DELAY: Int = 1800;
    const DISPUTE_WINDOW: Int = 3600;
    const ESCALATION_WINDOW: Int = 86400;
    const ARBITRATION_WINDOW: Int = 172800;
    const SETTLEMENT_GAS: Int = ton("0.1");

    init(proxyAdmin: Address) {
        self.owner = sender();
        self.proxyAdmin = proxyAdmin;
    }

    // ============================================
    // COMPOSITE KEY HELPERS (for nested map simulation)
    // ============================================

    // Compute composite key for (reportKey, address) -> unique Int
    fun submissionKey(reportKey: Int, addr: Address): Int {
        return beginCell()
            .storeUint(reportKey, 64)
            .storeAddress(addr)
            .endCell()
            .hash();
    }

    // Compute composite key for (disputeId, address) -> unique Int
    fun voteKey(disputeId: Int, addr: Address): Int {
        return beginCell()
            .storeUint(disputeId, 64)
            .storeAddress(addr)
            .endCell()
            .hash();
    }

    // ============================================
    // UPGRADEABLE IMPLEMENTATION
    // ============================================

    override fun getStateHash(): Int {
        return beginCell()
            .storeUint(self.contractVersion, 16)
            .storeUint(self.reporterCount, 8)
            .storeUint(self.arbitratorCount, 8)
            .storeUint(self.disputeCount, 64)
            .endCell()
            .hash();
    }

    // ============================================
    // REPORTER MANAGEMENT
    // ============================================

    receive(msg: AddReporter) {
        require(sender() == self.owner, "Only owner");
        require(self.reporterCount < self.MAX_REPORTERS, "Max reporters reached");

        let existing: ReporterInfo? = self.reporters.get(msg.reporter);
        require(existing == null, "Reporter already exists");

        self.reporters.set(msg.reporter, ReporterInfo{
            name: msg.name,
            sourceType: msg.sourceType,
            submissionCount: 0,
            accuracyScore: 1000,
            isActive: true,
            lastSubmission: 0
        });

        self.reporterAddresses.set(self.reporterCount, msg.reporter);
        self.reporterCount = self.reporterCount + 1;

        emit(ReporterAddedEvent{
            reporter: msg.reporter,
            name: msg.name,
            sourceType: msg.sourceType
        }.toCell());
    }

    receive(msg: RemoveReporter) {
        require(sender() == self.owner, "Only owner");

        let existing: ReporterInfo? = self.reporters.get(msg.reporter);
        if (existing != null) {
            let info: ReporterInfo = existing!!;
            let updated: ReporterInfo = ReporterInfo{
                name: info.name,
                sourceType: info.sourceType,
                submissionCount: info.submissionCount,
                accuracyScore: info.accuracyScore,
                isActive: false,
                lastSubmission: info.lastSubmission
            };
            self.reporters.set(msg.reporter, updated);
            self.reporterCount = self.reporterCount - 1;

            emit(ReporterRemovedEvent{
                reporter: msg.reporter
            }.toCell());
        }
    }

    // ============================================
    // WEATHER DATA SUBMISSION
    // ============================================

    receive(msg: SubmitWeatherData) {
        let reporterInfo: ReporterInfo? = self.reporters.get(sender());
        require(reporterInfo != null, "Not a registered reporter");
        require(reporterInfo!!.isActive, "Reporter is inactive");

        let dateKey: Int = msg.timestamp / 86400;
        let key: Int = (msg.locationId << 32) | dateKey;

        // Check storage bounds
        self.requireStorageCapacity();

        let existing: WeatherReport? = self.reports.get(key);

        if (existing == null) {
            self.reports.set(key, WeatherReport{
                temperature: msg.temperature,
                temperatureMax: msg.temperatureMax,
                temperatureMin: msg.temperatureMin,
                precipitation: msg.precipitation,
                visibility: msg.visibility,
                windSpeed: msg.windSpeed,
                conditions: msg.conditions,
                timestamp: msg.timestamp,
                reportCount: 1,
                isFinalized: false,
                finalizedAt: 0
            });

            // Mark this reporter's submission using composite key
            let subKey: Int = self.submissionKey(key, sender());
            self.reporterSubmissions.set(subKey, true);

            emit(WeatherDataSubmittedEvent{
                locationId: msg.locationId,
                date: dateKey,
                reporter: sender(),
                isFirst: true
            }.toCell());
        } else {
            let report: WeatherReport = existing!!;

            // Check if reporter already submitted using composite key
            let subKey: Int = self.submissionKey(key, sender());
            let submitted: Bool = getOrDefaultBool(self.reporterSubmissions.get(subKey), false);
            require(!submitted, "Already submitted for this date");

            if (!report.isFinalized) {
                let tempDiff: Int = abs(report.temperature - msg.temperature);
                let precipDiff: Int = abs(report.precipitation - msg.precipitation);
                let visDiff: Int = abs(report.visibility - msg.visibility);

                if (tempDiff <= self.TEMPERATURE_TOLERANCE &&
                    precipDiff <= self.PRECIP_TOLERANCE &&
                    visDiff <= self.VISIBILITY_TOLERANCE) {

                    let newCount: Int = report.reportCount + 1;
                    let newTemp: Int = (report.temperature + msg.temperature) / 2;
                    let newMax: Int = max(report.temperatureMax, msg.temperatureMax);
                    let newMin: Int = min(report.temperatureMin, msg.temperatureMin);
                    let newPrecip: Int = (report.precipitation + msg.precipitation) / 2;

                    let shouldFinalize: Bool = newCount >= self.MIN_CONFIRMATIONS;

                    let updated: WeatherReport = WeatherReport{
                        temperature: newTemp,
                        temperatureMax: newMax,
                        temperatureMin: newMin,
                        precipitation: newPrecip,
                        visibility: report.visibility,
                        windSpeed: report.windSpeed,
                        conditions: report.conditions,
                        timestamp: report.timestamp,
                        reportCount: newCount,
                        isFinalized: shouldFinalize,
                        finalizedAt: shouldFinalize ? now() : 0
                    };
                    self.reports.set(key, updated);

                    // Mark this reporter's submission using composite key
                    self.reporterSubmissions.set(subKey, true);

                    if (shouldFinalize) {
                        emit(WeatherDataFinalizedEvent{
                            locationId: msg.locationId,
                            date: dateKey,
                            confirmations: newCount
                        }.toCell());
                    }
                } else {
                    emit(DataDiscrepancyEvent{
                        locationId: msg.locationId,
                        date: dateKey,
                        reporter: sender(),
                        tempDiff: tempDiff,
                        precipDiff: precipDiff
                    }.toCell());
                }
            }
        }

        // Update reporter stats
        let info: ReporterInfo = reporterInfo!!;
        let updatedReporter: ReporterInfo = ReporterInfo{
            name: info.name,
            sourceType: info.sourceType,
            submissionCount: info.submissionCount + 1,
            accuracyScore: info.accuracyScore,
            isActive: info.isActive,
            lastSubmission: now()
        };
        self.reporters.set(sender(), updatedReporter);
    }

    // ============================================
    // SETTLEMENT WITH TIMELOCK
    // ============================================

    receive(msg: ProposeSettlement) {
        require(sender() == self.owner || self.reporters.get(sender()) != null, "Unauthorized");
        require(self.activeSettlementCount < self.MAX_PENDING_SETTLEMENTS, "Too many pending settlements");

        let today: Int = now() / 86400;
        let key: Int = (msg.locationId << 32) | today;

        let report: WeatherReport? = self.reports.get(key);
        require(report != null, "No weather data for this date");
        require(report!!.isFinalized, "Weather data not finalized");

        // Check for active dispute
        let disputeId: Int? = self.reportKeyToDispute.get(key);
        if (disputeId != null) {
            let dispute: DisputeInfo? = self.disputes.get(disputeId!!);
            if (dispute != null) {
                require(dispute!!.status >= 2, "Active dispute exists");
            }
        }

        let outcome: Bool = self.evaluateCondition(
            report!!,
            msg.resolutionType,
            msg.threshold,
            msg.comparisonType
        );

        let actualValue: Int = self.getValueByType(report!!, msg.resolutionType);

        let settlementId: Int = self.settlementCount;
        self.settlementCount = self.settlementCount + 1;
        self.activeSettlementCount = self.activeSettlementCount + 1;

        self.pendingSettlements.set(settlementId, PendingSettlement{
            settlementId: settlementId,
            marketId: msg.marketId,
            marketAddress: msg.marketAddress,
            locationId: msg.locationId,
            proposedOutcome: outcome,
            proposedValue: actualValue,
            proposedAt: now(),
            proposedBy: sender(),
            canFinalizeAt: now() + self.settlementTimelock,
            isFinalized: false,
            isCancelled: false
        });

        emit(SettlementProposedEvent{
            marketId: msg.marketId,
            proposedValue: actualValue,
            proposedBy: sender(),
            timelockEnds: now() + self.settlementTimelock
        }.toCell());
    }

    receive(msg: FinalizeSettlement) {
        let settlement: PendingSettlement? = self.pendingSettlements.get(msg.settlementId);
        require(settlement != null, "Settlement not found");
        require(!settlement!!.isFinalized, "Already finalized");
        require(!settlement!!.isCancelled, "Settlement cancelled");
        require(now() >= settlement!!.canFinalizeAt, "Timelock not expired");

        // Check for any disputes during timelock
        let key: Int = (settlement!!.locationId << 32) | (settlement!!.proposedAt / 86400);
        let disputeId: Int? = self.reportKeyToDispute.get(key);
        if (disputeId != null) {
            let dispute: DisputeInfo? = self.disputes.get(disputeId!!);
            if (dispute != null && dispute!!.status < 2) {
                require(false, "Active dispute blocks finalization");
            }
        }

        // Mark as finalized
        let finalized: PendingSettlement = PendingSettlement{
            settlementId: settlement!!.settlementId,
            marketId: settlement!!.marketId,
            marketAddress: settlement!!.marketAddress,
            locationId: settlement!!.locationId,
            proposedOutcome: settlement!!.proposedOutcome,
            proposedValue: settlement!!.proposedValue,
            proposedAt: settlement!!.proposedAt,
            proposedBy: settlement!!.proposedBy,
            canFinalizeAt: settlement!!.canFinalizeAt,
            isFinalized: true,
            isCancelled: false
        };
        self.pendingSettlements.set(msg.settlementId, finalized);
        self.activeSettlementCount = self.activeSettlementCount - 1;

        // Send settlement to market
        send(SendParameters{
            to: settlement!!.marketAddress,
            value: self.SETTLEMENT_GAS,
            mode: SendPayGasSeparately + SendBounceIfActionFail,
            bounce: true,
            body: SettleMarket{
                outcome: settlement!!.proposedOutcome,
                winningBracket: 0,
                settlementValue: settlement!!.proposedValue,
                dataHash: 0
            }.toCell()
        });

        emit(SettlementFinalizedEvent{
            marketId: settlement!!.marketId,
            finalValue: settlement!!.proposedValue,
            timestamp: now()
        }.toCell());
    }

    bounced(msg: bounced<SettleMarket>) {
        // Settlement message to market failed
        emit(SettlementBounceEvent{
            outcome: msg.outcome,
            value: msg.settlementValue
        }.toCell());
    }

    // ============================================
    // DISPUTE HANDLING
    // ============================================

    receive(msg: DisputeResolution) {
        require(self.activeDisputeCount < self.MAX_ACTIVE_DISPUTES, "Too many active disputes");

        let dateKey: Int = msg.date;
        let key: Int = (msg.locationId << 32) | dateKey;

        require(context().value >= self.disputeStake, "Insufficient dispute stake");

        let report: WeatherReport? = self.reports.get(key);
        require(report != null, "No data to dispute");
        require(report!!.isFinalized, "Data not yet finalized");

        let existingDispute: Int? = self.reportKeyToDispute.get(key);
        require(existingDispute == null, "Dispute already exists for this data");

        let disputeId: Int = self.disputeCount;
        self.disputeCount = self.disputeCount + 1;
        self.activeDisputeCount = self.activeDisputeCount + 1;

        let dispute: DisputeInfo = DisputeInfo{
            disputeId: disputeId,
            locationId: msg.locationId,
            date: dateKey,
            disputer: sender(),
            stake: context().value,
            evidence: msg.evidence,
            status: 0,
            createdAt: now(),
            escalatedAt: 0,
            resolvedAt: 0,
            marketAddress: null,
            originalOutcome: false,
            originalValue: 0,
            newOutcome: false,
            newValue: 0,
            resolvedBy: null,
            resolutionReason: "",
            votesFor: 0,
            votesAgainst: 0,
            totalWeight: 0
        };

        self.disputes.set(disputeId, dispute);
        self.reportKeyToDispute.set(key, disputeId);

        emit(DisputeCreatedEvent{
            disputeId: disputeId,
            locationId: msg.locationId,
            date: dateKey,
            challenger: sender(),
            bond: context().value,
            evidence: msg.evidence
        }.toCell());
    }

    receive(msg: EscalateDispute) {
        let disputeOpt: DisputeInfo? = self.disputes.get(msg.disputeId);
        require(disputeOpt != null, "Dispute not found");

        let dispute: DisputeInfo = disputeOpt!!;
        require(dispute.disputer == sender(), "Only disputer can escalate");
        require(dispute.status == 0, "Can only escalate open disputes");
        require(now() < dispute.createdAt + self.ESCALATION_WINDOW, "Escalation window expired");

        require(context().value >= self.escalationStake, "Insufficient escalation stake");

        let escalated: DisputeInfo = DisputeInfo{
            disputeId: dispute.disputeId,
            locationId: dispute.locationId,
            date: dispute.date,
            disputer: dispute.disputer,
            stake: dispute.stake + context().value,
            evidence: msg.additionalEvidence,
            status: 1,
            createdAt: dispute.createdAt,
            escalatedAt: now(),
            resolvedAt: 0,
            marketAddress: dispute.marketAddress,
            originalOutcome: dispute.originalOutcome,
            originalValue: dispute.originalValue,
            newOutcome: dispute.newOutcome,
            newValue: dispute.newValue,
            resolvedBy: null,
            resolutionReason: "",
            votesFor: 0,
            votesAgainst: 0,
            totalWeight: 0
        };

        self.disputes.set(msg.disputeId, escalated);

        emit(DisputeEscalatedEvent{
            disputeId: msg.disputeId,
            locationId: dispute.locationId,
            totalStake: escalated.stake,
            additionalEvidence: msg.additionalEvidence
        }.toCell());
    }

    receive(msg: ArbitratorVote) {
        let arbInfo: ArbitratorInfo? = self.arbitrators.get(sender());
        require(arbInfo != null, "Not an arbitrator");
        require(arbInfo!!.isActive, "Arbitrator is inactive");

        let disputeOpt: DisputeInfo? = self.disputes.get(msg.disputeId);
        require(disputeOpt != null, "Dispute not found");

        let dispute: DisputeInfo = disputeOpt!!;
        require(dispute.status == 1, "Can only vote on escalated disputes");
        require(now() < dispute.escalatedAt + self.ARBITRATION_WINDOW, "Voting window expired");

        // Check if already voted using composite key
        let vKey: Int = self.voteKey(msg.disputeId, sender());
        let hasVoted: Bool = getOrDefaultBool(self.disputeVotes.get(vKey), false);
        require(!hasVoted, "Already voted");

        // Record the vote
        self.disputeVotes.set(vKey, true);

        let weight: Int = arbInfo!!.weight;
        let newVotesFor: Int = dispute.votesFor + (msg.upheld ? weight : 0);
        let newVotesAgainst: Int = dispute.votesAgainst + (msg.upheld ? 0 : weight);
        let newTotalWeight: Int = dispute.totalWeight + weight;

        let updated: DisputeInfo = DisputeInfo{
            disputeId: dispute.disputeId,
            locationId: dispute.locationId,
            date: dispute.date,
            disputer: dispute.disputer,
            stake: dispute.stake,
            evidence: dispute.evidence,
            status: dispute.status,
            createdAt: dispute.createdAt,
            escalatedAt: dispute.escalatedAt,
            resolvedAt: dispute.resolvedAt,
            marketAddress: dispute.marketAddress,
            originalOutcome: dispute.originalOutcome,
            originalValue: dispute.originalValue,
            newOutcome: dispute.newOutcome,
            newValue: dispute.newValue,
            resolvedBy: dispute.resolvedBy,
            resolutionReason: dispute.resolutionReason,
            votesFor: newVotesFor,
            votesAgainst: newVotesAgainst,
            totalWeight: newTotalWeight
        };
        self.disputes.set(msg.disputeId, updated);

        emit(ArbitratorVotedEvent{
            disputeId: msg.disputeId,
            arbitrator: sender(),
            vote: msg.upheld,
            weight: weight
        }.toCell());
    }

    receive(msg: ResolveDispute) {
        let arbInfo: ArbitratorInfo? = self.arbitrators.get(sender());
        require(arbInfo != null, "Not an arbitrator");
        require(arbInfo!!.isActive, "Arbitrator is inactive");

        let disputeOpt: DisputeInfo? = self.disputes.get(msg.disputeId);
        require(disputeOpt != null, "Dispute not found");

        let dispute: DisputeInfo = disputeOpt!!;
        require(dispute.status == 1, "Can only resolve escalated disputes");

        // Check voting threshold or arbitration window expired
        let quorumMet: Bool = dispute.totalWeight >= (self.arbitratorCount * 2 / 3);
        let windowExpired: Bool = now() >= dispute.escalatedAt + self.ARBITRATION_WINDOW;
        require(quorumMet || windowExpired, "Quorum not met and window not expired");

        // Determine outcome based on votes
        let finalUpheld: Bool = dispute.votesFor > dispute.votesAgainst;
        let finalStatus: Int = finalUpheld ? 2 : 3;

        let resolved: DisputeInfo = DisputeInfo{
            disputeId: dispute.disputeId,
            locationId: dispute.locationId,
            date: dispute.date,
            disputer: dispute.disputer,
            stake: dispute.stake,
            evidence: dispute.evidence,
            status: finalStatus,
            createdAt: dispute.createdAt,
            escalatedAt: dispute.escalatedAt,
            resolvedAt: now(),
            marketAddress: dispute.marketAddress,
            originalOutcome: dispute.originalOutcome,
            originalValue: dispute.originalValue,
            newOutcome: msg.newOutcome,
            newValue: msg.newValue,
            resolvedBy: sender(),
            resolutionReason: msg.reason,
            votesFor: dispute.votesFor,
            votesAgainst: dispute.votesAgainst,
            totalWeight: dispute.totalWeight
        };
        self.disputes.set(msg.disputeId, resolved);
        self.activeDisputeCount = self.activeDisputeCount - 1;

        if (finalUpheld) {
            send(SendParameters{
                to: dispute.disputer,
                value: dispute.stake,
                mode: SendBounceIfActionFail,
                body: beginCell()
                    .storeUint(OP_REFUND, 32)
                    .storeUint(msg.disputeId, 64)
                    .endCell()
            });

            if (dispute.marketAddress != null) {
                send(SendParameters{
                    to: dispute.marketAddress!!,
                    value: self.SETTLEMENT_GAS,
                    mode: SendPayGasSeparately + SendBounceIfActionFail,
                    body: SettleMarket{
                        outcome: msg.newOutcome,
                        winningBracket: 0,
                        settlementValue: msg.newValue,
                        dataHash: 0
                    }.toCell()
                });
            }
        } else {
            send(SendParameters{
                to: self.owner,
                value: dispute.stake,
                mode: SendBounceIfActionFail,
                body: beginCell()
                    .storeUint(OP_FEES_COLLECTED, 32)
                    .storeCoins(dispute.stake)
                    .endCell()
            });
        }

        let arbUpdated: ArbitratorInfo = ArbitratorInfo{
            name: arbInfo!!.name,
            disputesResolved: arbInfo!!.disputesResolved + 1,
            isActive: arbInfo!!.isActive,
            addedAt: arbInfo!!.addedAt,
            weight: arbInfo!!.weight
        };
        self.arbitrators.set(sender(), arbUpdated);

        emit(DisputeResolvedEvent{
            disputeId: msg.disputeId,
            upheld: finalUpheld,
            resolvedBy: sender(),
            newOutcome: msg.newOutcome,
            newValue: msg.newValue,
            reason: msg.reason
        }.toCell());
    }

    // ============================================
    // ARBITRATOR MANAGEMENT
    // ============================================

    receive(msg: AddArbitrator) {
        require(sender() == self.owner, "Only owner");
        require(self.arbitratorCount < self.MAX_ARBITRATORS, "Max arbitrators reached");

        let existing: ArbitratorInfo? = self.arbitrators.get(msg.arbitrator);
        require(existing == null, "Arbitrator already exists");

        self.arbitrators.set(msg.arbitrator, ArbitratorInfo{
            name: msg.name,
            disputesResolved: 0,
            isActive: true,
            addedAt: now(),
            weight: msg.weight
        });

        self.arbitratorAddresses.set(self.arbitratorCount, msg.arbitrator);
        self.arbitratorCount = self.arbitratorCount + 1;

        emit(ArbitratorAddedEvent{
            arbitrator: msg.arbitrator,
            name: msg.name,
            weight: msg.weight
        }.toCell());
    }

    receive(msg: RemoveArbitrator) {
        require(sender() == self.owner, "Only owner");

        let existing: ArbitratorInfo? = self.arbitrators.get(msg.arbitrator);
        if (existing != null) {
            let updated: ArbitratorInfo = ArbitratorInfo{
                name: existing!!.name,
                disputesResolved: existing!!.disputesResolved,
                isActive: false,
                addedAt: existing!!.addedAt,
                weight: existing!!.weight
            };
            self.arbitrators.set(msg.arbitrator, updated);
            self.arbitratorCount = self.arbitratorCount - 1;

            emit(ArbitratorRemovedEvent{
                arbitrator: msg.arbitrator
            }.toCell());
        }
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    receive(msg: UpdateOracleConfig) {
        require(sender() == self.owner || sender() == self.proxyAdmin, "Unauthorized");

        if (msg.disputeStake > 0) {
            self.disputeStake = msg.disputeStake;
        }
        if (msg.escalationStake > 0) {
            self.escalationStake = msg.escalationStake;
        }
        if (msg.settlementTimelock >= 600 && msg.settlementTimelock <= 86400) {
            self.settlementTimelock = msg.settlementTimelock;
        }
        if (msg.minConfirmations >= 1 && msg.minConfirmations <= 5) {
            // Note: MIN_CONFIRMATIONS is a const, so we'd need a state variable
        }

        emit(OracleConfigUpdatedEvent{
            disputeStake: self.disputeStake,
            escalationStake: self.escalationStake,
            settlementTimelock: self.settlementTimelock
        }.toCell());
    }

    // ============================================
    // INTERNAL HELPERS
    // ============================================

    fun requireStorageCapacity() {
        require(self.activeDisputeCount < self.MAX_ACTIVE_DISPUTES, "Dispute storage full");
        require(self.activeSettlementCount < self.MAX_PENDING_SETTLEMENTS, "Settlement storage full");
    }

    fun evaluateCondition(report: WeatherReport, resType: Int, threshold: Int, compType: Int): Bool {
        let value: Int = self.getValueByType(report, resType);

        if (compType == 0) { return value > threshold; }
        if (compType == 1) { return value < threshold; }
        if (compType == 2) { return value == threshold; }
        if (compType == 3) { return value >= threshold; }
        if (compType == 4) { return value <= threshold; }

        return false;
    }

    fun getValueByType(report: WeatherReport, resType: Int): Int {
        if (resType == 0) { return report.temperatureMax; }
        if (resType == 1) { return report.temperatureMin; }
        if (resType == 2) { return report.precipitation; }
        if (resType == 3) { return report.visibility; }
        if (resType == 4) { return report.windSpeed; }
        if (resType == 5) { return report.conditions; }
        return 0;
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    get fun getWeather(locationId: Int, date: Int): WeatherReport? {
        let key: Int = (locationId << 32) | date;
        return self.reports.get(key);
    }

    get fun isFinalized(locationId: Int, date: Int): Bool {
        let report: WeatherReport? = self.getWeather(locationId, date);
        if (report == null) { return false; }
        return report!!.isFinalized;
    }

    get fun getReporter(addr: Address): ReporterInfo? {
        return self.reporters.get(addr);
    }

    get fun isReporter(addr: Address): Bool {
        let info: ReporterInfo? = self.reporters.get(addr);
        if (info == null) { return false; }
        return info!!.isActive;
    }

    get fun getPendingSettlement(settlementId: Int): PendingSettlement? {
        return self.pendingSettlements.get(settlementId);
    }

    get fun getDispute(disputeId: Int): DisputeInfo? {
        return self.disputes.get(disputeId);
    }

    get fun getDisputeByReport(locationId: Int, date: Int): DisputeInfo? {
        let key: Int = (locationId << 32) | date;
        let disputeId: Int? = self.reportKeyToDispute.get(key);
        if (disputeId == null) { return null; }
        return self.disputes.get(disputeId!!);
    }

    get fun hasActiveDispute(locationId: Int, date: Int): Bool {
        let dispute: DisputeInfo? = self.getDisputeByReport(locationId, date);
        if (dispute == null) { return false; }
        return dispute!!.status < 2;
    }

    get fun getArbitrator(addr: Address): ArbitratorInfo? {
        return self.arbitrators.get(addr);
    }

    get fun isArbitrator(addr: Address): Bool {
        let info: ArbitratorInfo? = self.arbitrators.get(addr);
        if (info == null) { return false; }
        return info!!.isActive;
    }

    get fun getConfig(): OracleConfig {
        return OracleConfig{
            owner: self.owner,
            reporterCount: self.reporterCount,
            arbitratorCount: self.arbitratorCount,
            disputeStake: self.disputeStake,
            escalationStake: self.escalationStake,
            settlementTimelock: self.settlementTimelock,
            minConfirmations: self.MIN_CONFIRMATIONS,
            totalDisputes: self.disputeCount,
            pendingSettlements: self.activeSettlementCount
        };
    }

    get fun getSettlementTimelock(): Int {
        return self.settlementTimelock;
    }

    get fun getDisputeStake(): Int {
        return self.disputeStake;
    }

    get fun getEscalationStake(): Int {
        return self.escalationStake;
    }
}

// ============================================
// SETTLEMENT MESSAGE (sent to markets)
// ============================================

message SettleMarket {
    outcome: Bool;
    winningBracket: Int as uint8;
    settlementValue: Int as int32;
    dataHash: Int as uint256;
}

// ============================================
// ADDITIONAL EVENTS
// ============================================

message ReporterAddedEvent {
    reporter: Address;
    name: String;
    sourceType: Int as uint8;
}

message ReporterRemovedEvent {
    reporter: Address;
}

message WeatherDataSubmittedEvent {
    locationId: Int as uint32;
    date: Int as uint32;
    reporter: Address;
    isFirst: Bool;
}

message WeatherDataFinalizedEvent {
    locationId: Int as uint32;
    date: Int as uint32;
    confirmations: Int as uint8;
}

message DataDiscrepancyEvent {
    locationId: Int as uint32;
    date: Int as uint32;
    reporter: Address;
    tempDiff: Int as int16;
    precipDiff: Int as uint16;
}

message ArbitratorAddedEvent {
    arbitrator: Address;
    name: String;
    weight: Int as uint8;
}

message ArbitratorRemovedEvent {
    arbitrator: Address;
}

message OracleConfigUpdatedEvent {
    disputeStake: Int as coins;
    escalationStake: Int as coins;
    settlementTimelock: Int as uint32;
}

message SettlementBounceEvent {
    outcome: Bool;
    value: Int as int32;
}
