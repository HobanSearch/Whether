/**
 * Whether Oracle Bot - Contract Integration
 * Submits weather data to OracleResolver contract
 */

import { Address, toNano, TonClient, WalletContractV4 } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WeatherData, ConsensusResult, SubmissionResult } from './types';

// Import from the contracts build
import { OracleResolver } from './oracle-wrapper';

export class OracleContract {
    private client: TonClient;
    private wallet: WalletContractV4 | null = null;
    private walletContract: any = null;
    private contractAddress: Address;

    constructor(endpoint: string, apiKey: string, contractAddress: string) {
        this.client = new TonClient({
            endpoint,
            apiKey,
        });
        this.contractAddress = Address.parse(contractAddress);
    }

    /**
     * Initialize wallet from mnemonic
     */
    async initWallet(mnemonic: string): Promise<Address> {
        const mnemonicWords = mnemonic.split(' ');
        const keyPair = await mnemonicToPrivateKey(mnemonicWords);

        this.wallet = WalletContractV4.create({
            publicKey: keyPair.publicKey,
            workchain: 0,
        });

        this.walletContract = this.client.open(this.wallet);

        console.log('[Contract] Wallet initialized:', this.wallet.address.toString());
        return this.wallet.address;
    }

    /**
     * Get wallet balance
     */
    async getBalance(): Promise<bigint> {
        if (!this.wallet) {
            throw new Error('Wallet not initialized');
        }
        return await this.walletContract.getBalance();
    }

    /**
     * Submit weather data to contract
     */
    async submitWeatherData(
        data: WeatherData,
        sourceHash: bigint
    ): Promise<SubmissionResult> {
        if (!this.wallet || !this.walletContract) {
            return {
                success: false,
                locationId: data.locationId,
                error: 'Wallet not initialized',
            };
        }

        try {
            // Open the OracleResolver contract
            const oracle = this.client.open(
                OracleResolver.fromAddress(this.contractAddress)
            );

            // Build the SubmitWeatherData message
            const message = {
                $$type: 'SubmitWeatherData' as const,
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
            };

            console.log(`[Contract] Submitting weather data for location ${data.locationId}...`);

            // Send the message
            await oracle.send(
                this.walletContract.sender(await this.getSecretKey()),
                {
                    value: toNano('0.1'),
                },
                message
            );

            console.log(`[Contract] Weather data submitted for location ${data.locationId}`);

            return {
                success: true,
                locationId: data.locationId,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[Contract] Error submitting weather data:`, errorMessage);

            return {
                success: false,
                locationId: data.locationId,
                error: errorMessage,
            };
        }
    }

    /**
     * Submit consensus result to contract
     */
    async submitConsensus(result: ConsensusResult): Promise<SubmissionResult> {
        if (!result.success || !result.data) {
            return {
                success: false,
                locationId: result.data?.locationId ?? 0,
                error: 'No consensus data available',
            };
        }

        return this.submitWeatherData(result.data, result.sourceHash);
    }

    /**
     * Check if reporter is authorized
     */
    async isReporter(): Promise<boolean> {
        if (!this.wallet) {
            return false;
        }

        try {
            const oracle = this.client.open(
                OracleResolver.fromAddress(this.contractAddress)
            );

            const isReporter = await oracle.getIsReporter(this.wallet.address);
            return isReporter;
        } catch (error) {
            console.error('[Contract] Error checking reporter status:', error);
            return false;
        }
    }

    /**
     * Get oracle configuration
     */
    async getConfig(): Promise<any> {
        try {
            const oracle = this.client.open(
                OracleResolver.fromAddress(this.contractAddress)
            );

            return await oracle.getGetConfig();
        } catch (error) {
            console.error('[Contract] Error getting config:', error);
            return null;
        }
    }

    /**
     * Get weather report for location/date
     */
    async getWeather(locationId: number, date: number): Promise<any> {
        try {
            const oracle = this.client.open(
                OracleResolver.fromAddress(this.contractAddress)
            );

            return await oracle.getGetWeather(BigInt(locationId), BigInt(date));
        } catch (error) {
            console.error('[Contract] Error getting weather:', error);
            return null;
        }
    }

    /**
     * Get private key from mnemonic (internal use)
     */
    private async getSecretKey(): Promise<Buffer> {
        // Note: This is a simplified implementation
        // In production, you'd want to cache this or use a more secure key management
        throw new Error('getSecretKey needs to be implemented with proper key management');
    }
}

/**
 * Create a simplified sender for the wallet
 * This is a workaround since we need to manage the private key separately
 */
export async function createWalletSender(
    client: TonClient,
    mnemonic: string
): Promise<{ wallet: WalletContractV4; sender: any; address: Address }> {
    const mnemonicWords = mnemonic.split(' ');
    const keyPair = await mnemonicToPrivateKey(mnemonicWords);

    const wallet = WalletContractV4.create({
        publicKey: keyPair.publicKey,
        workchain: 0,
    });

    const walletContract = client.open(wallet);

    // Get seqno for the transaction
    const seqno = await walletContract.getSeqno();

    const sender = {
        address: wallet.address,
        send: async (args: any) => {
            const transfer = wallet.createTransfer({
                seqno,
                secretKey: keyPair.secretKey,
                messages: [args],
            });
            await client.sendExternalMessage(wallet, transfer);
        },
    };

    return {
        wallet,
        sender: walletContract.sender(keyPair.secretKey),
        address: wallet.address,
    };
}
