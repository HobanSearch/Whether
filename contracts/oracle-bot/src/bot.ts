/**
 * Whether Oracle Bot - Main Orchestrator
 * Coordinates weather data fetching, consensus, and contract submission
 */

import { TonClient, WalletContractV4, Address, toNano } from '@ton/ton';
import { mnemonicToPrivateKey, KeyPair } from '@ton/crypto';
import {
    Location,
    WeatherSource,
    BotConfig,
    SubmissionResult,
} from './types';
import { getLocation, ALL_LOCATIONS, isAirport } from './locations';
import { ConsensusCalculator } from './consensus';
import { CheckWXSource } from './sources/checkwx';
import { OpenWeatherSource } from './sources/openweather';
import { OpenMeteoSource } from './sources/openmeteo';
import { OracleResolver } from './oracle-wrapper';

export class OracleBot {
    private config: BotConfig;
    private sources: WeatherSource[] = [];
    private consensus: ConsensusCalculator;
    private client: TonClient;
    private wallet: WalletContractV4 | null = null;
    private keyPair: KeyPair | null = null;
    private isRunning = false;

    constructor(config: BotConfig) {
        this.config = config;
        this.consensus = new ConsensusCalculator();

        // Initialize TON client
        this.client = new TonClient({
            endpoint: config.tonEndpoint,
            apiKey: config.tonApiKey,
        });

        // Initialize weather sources
        this.initializeSources();
    }

    private initializeSources(): void {
        // CheckWX for airports (requires API key)
        if (this.config.checkwxApiKey) {
            this.sources.push(new CheckWXSource(this.config.checkwxApiKey));
            console.log('[Bot] CheckWX source enabled');
        }

        // OpenWeatherMap (requires API key)
        if (this.config.openweatherApiKey) {
            this.sources.push(new OpenWeatherSource(this.config.openweatherApiKey));
            console.log('[Bot] OpenWeatherMap source enabled');
        }

        // Open-Meteo (free, no API key)
        this.sources.push(new OpenMeteoSource());
        console.log('[Bot] Open-Meteo source enabled');

        if (this.sources.length < 2) {
            console.warn('[Bot] Warning: Less than 2 sources available. Consensus may fail.');
        }
    }

    /**
     * Initialize wallet from mnemonic
     */
    async initWallet(): Promise<void> {
        if (!this.config.walletMnemonic) {
            throw new Error('Wallet mnemonic not configured');
        }

        const mnemonicWords = this.config.walletMnemonic.split(' ');
        if (mnemonicWords.length !== 24) {
            throw new Error('Invalid mnemonic: expected 24 words');
        }

        this.keyPair = await mnemonicToPrivateKey(mnemonicWords);

        this.wallet = WalletContractV4.create({
            publicKey: this.keyPair.publicKey,
            workchain: 0,
        });

        console.log('[Bot] Wallet initialized:', this.wallet.address.toString());

        // Check balance
        const walletContract = this.client.open(this.wallet);
        const balance = await walletContract.getBalance();
        console.log('[Bot] Wallet balance:', Number(balance) / 1e9, 'TON');

        if (balance < toNano('0.5')) {
            console.warn('[Bot] Warning: Low wallet balance. Submissions may fail.');
        }
    }

    /**
     * Check if wallet is registered as reporter
     */
    async checkReporterStatus(): Promise<boolean> {
        if (!this.wallet) {
            throw new Error('Wallet not initialized');
        }

        try {
            const oracle = this.client.open(
                OracleResolver.fromAddress(Address.parse(this.config.oracleContract))
            );

            const isReporter = await oracle.getIsReporter(this.wallet.address);
            console.log('[Bot] Reporter status:', isReporter ? 'Authorized' : 'Not authorized');

            if (!isReporter) {
                console.error('[Bot] Wallet is not registered as a reporter!');
                console.log('[Bot] Please run setupOracle script to add this wallet as a reporter.');
            }

            return isReporter;
        } catch (error) {
            console.error('[Bot] Error checking reporter status:', error);
            return false;
        }
    }

    /**
     * Fetch and submit weather data for a single location
     */
    async processLocation(location: Location): Promise<SubmissionResult> {
        console.log(`[Bot] Processing ${location.code} (${location.name})...`);

        // Get appropriate sources for this location type
        const sourcesForLocation = this.sources.filter(source => {
            // CheckWX only works for airports
            if (source.name === 'checkwx') {
                return isAirport(location);
            }
            return true;
        });

        if (sourcesForLocation.length < 2) {
            console.warn(`[Bot] ${location.code}: Not enough sources available`);
            return {
                success: false,
                locationId: location.id,
                error: 'Not enough sources available',
            };
        }

        // Calculate consensus
        const result = await this.consensus.calculate(location, sourcesForLocation);

        if (!result.success || !result.data) {
            console.warn(`[Bot] ${location.code}: Consensus failed`);
            return {
                success: false,
                locationId: location.id,
                error: 'Consensus failed',
            };
        }

        console.log(`[Bot] ${location.code}: Consensus achieved (${result.sourceCount} sources)`);
        console.log(`[Bot] ${location.code}: Temp=${result.data.temperature / 10}°C, Wind=${result.data.windSpeed / 10}kt`);

        // Submit to contract
        return await this.submitToContract(result.data, result.sourceHash);
    }

    /**
     * Submit weather data to the OracleResolver contract
     */
    private async submitToContract(
        data: any,
        sourceHash: bigint
    ): Promise<SubmissionResult> {
        if (!this.wallet || !this.keyPair) {
            return {
                success: false,
                locationId: data.locationId,
                error: 'Wallet not initialized',
            };
        }

        try {
            const oracle = this.client.open(
                OracleResolver.fromAddress(Address.parse(this.config.oracleContract))
            );

            const walletContract = this.client.open(this.wallet);

            await oracle.send(
                walletContract.sender(this.keyPair.secretKey),
                {
                    value: toNano('0.1'),
                },
                {
                    $$type: 'SubmitWeatherData',
                    locationId: BigInt(data.locationId),
                    timestamp: BigInt(data.timestamp),
                    temperature: BigInt(data.temperature),
                    temperatureMax: BigInt(data.temperatureMax),
                    temperatureMin: BigInt(data.temperatureMin),
                    precipitation: BigInt(data.precipitation),
                    visibility: BigInt(data.visibility),
                    windSpeed: BigInt(data.windSpeed),
                    windGust: BigInt(data.windGust),
                    pressure: BigInt(data.pressure),
                    humidity: BigInt(data.humidity),
                    conditions: BigInt(data.conditions),
                    sourceHash: sourceHash,
                }
            );

            console.log(`[Bot] Location ${data.locationId}: Submitted to contract`);

            return {
                success: true,
                locationId: data.locationId,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[Bot] Location ${data.locationId}: Submit failed -`, errorMessage);

            return {
                success: false,
                locationId: data.locationId,
                error: errorMessage,
            };
        }
    }

    /**
     * Process all configured locations
     */
    async processAllLocations(): Promise<void> {
        const locations = this.config.locations
            .map(code => getLocation(code))
            .filter((loc): loc is Location => loc !== undefined);

        if (locations.length === 0) {
            console.error('[Bot] No valid locations configured');
            return;
        }

        console.log(`[Bot] Processing ${locations.length} locations...`);

        const results: SubmissionResult[] = [];

        for (const location of locations) {
            try {
                const result = await this.processLocation(location);
                results.push(result);

                // Delay between submissions to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                console.error(`[Bot] Error processing ${location.code}:`, error);
                results.push({
                    success: false,
                    locationId: location.id,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        // Summary
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        console.log(`[Bot] Round complete: ${successful} successful, ${failed} failed`);
    }

    /**
     * Start the bot loop
     */
    async start(): Promise<void> {
        console.log('[Bot] Starting Whether Oracle Bot...');
        console.log(`[Bot] Interval: ${this.config.submitIntervalMs / 1000}s`);
        console.log(`[Bot] Locations: ${this.config.locations.join(', ')}`);

        // Initialize wallet
        await this.initWallet();

        // Check reporter status
        const isReporter = await this.checkReporterStatus();
        if (!isReporter) {
            console.error('[Bot] Exiting: Wallet is not authorized as reporter');
            return;
        }

        this.isRunning = true;

        // Initial run
        await this.processAllLocations();

        // Start loop
        while (this.isRunning) {
            console.log(`[Bot] Next run in ${this.config.submitIntervalMs / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, this.config.submitIntervalMs));

            if (this.isRunning) {
                await this.processAllLocations();
            }
        }
    }

    /**
     * Run once (no loop)
     */
    async runOnce(): Promise<void> {
        console.log('[Bot] Running single execution...');

        // Initialize wallet
        await this.initWallet();

        // Check reporter status
        const isReporter = await this.checkReporterStatus();
        if (!isReporter) {
            console.error('[Bot] Exiting: Wallet is not authorized as reporter');
            return;
        }

        // Process all locations once
        await this.processAllLocations();

        console.log('[Bot] Single execution complete');
    }

    /**
     * Stop the bot
     */
    stop(): void {
        console.log('[Bot] Stopping...');
        this.isRunning = false;
    }
}
