/**
 * Custom TON Contract Deployment Script
 *
 * Bypasses Blueprint's ESM/CommonJS issues by using TON SDK directly
 * with pre-compiled contract wrappers from the build directory.
 *
 * Usage:
 *   1. Copy .env.example to .env and add your mnemonic
 *   2. Run: npx tsx deploy.ts
 */

import * as dotenv from 'dotenv';
import { TonClient, WalletContractV5R1 } from '@ton/ton';
import { mnemonicToPrivateKey, KeyPair } from '@ton/crypto';
import { Address, toNano, beginCell, internal, OpenedContract, Sender } from '@ton/core';

// Import pre-compiled contract wrappers
import { OracleResolver, storeDeploy, storeAddReporter } from './build/OracleResolver/tact_OracleResolver.js';
import { MarketFactory, storeCreateMarket } from './build/MarketFactory/tact_MarketFactory.js';

dotenv.config();

// Configuration - Using toncenter JSON-RPC API
const TESTNET_ENDPOINT = 'https://testnet.toncenter.com/api/v2/jsonRPC';
const MAINNET_ENDPOINT = 'https://toncenter.com/api/v2/jsonRPC';

// Sleep utility
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Wait for contract to be deployed
async function waitForDeploy(client: TonClient, address: Address, maxAttempts: number = 60): Promise<boolean> {
    console.log(`  Waiting for deployment at ${address.toString()}...`);
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const state = await client.getContractState(address);
            if (state.state === 'active') {
                console.log(`\n  Contract deployed successfully!`);
                return true;
            }
        } catch (e) {
            // Contract not found yet, continue waiting
        }
        await sleep(5000); // Longer delay to avoid rate limiting
        process.stdout.write('.');
    }
    console.log('\n  Deployment timeout!');
    return false;
}

// Create sender from wallet with rate limiting
function createSender(wallet: OpenedContract<WalletContractV5R1>, keyPair: KeyPair): Sender {
    return {
        address: wallet.address,
        send: async (args) => {
            await sleep(5000); // Rate limit delay before getting seqno
            const seqno = await wallet.getSeqno();
            await sleep(5000); // Rate limit delay before sending
            await wallet.sendTransfer({
                seqno,
                secretKey: keyPair.secretKey,
                messages: [internal({
                    to: args.to,
                    value: args.value,
                    bounce: args.bounce ?? true,
                    body: args.body,
                    init: args.init,
                })]
            });
        }
    };
}

async function deployOracleResolver(
    client: TonClient,
    wallet: OpenedContract<WalletContractV5R1>,
    sender: Sender
): Promise<Address> {
    console.log('\n=== Deploying OracleResolver ===');

    // IMPORTANT: Convert wallet.address to @ton/core Address to avoid instanceof mismatch
    // wallet.address is from @ton/ton, but Tact-generated code uses @ton/core Address
    const deployerAddress = Address.parse(wallet.address.toString());
    console.log(`Proxy Admin: ${deployerAddress.toString()}`);

    // Create OracleResolver instance
    const oracleResolver = await OracleResolver.fromInit(deployerAddress);
    const contractAddress = oracleResolver.address;

    console.log(`Expected Address: ${contractAddress.toString()}`);

    // Check if already deployed
    try {
        const state = await client.getContractState(contractAddress);
        if (state.state === 'active') {
            console.log('OracleResolver already deployed!');
            return contractAddress;
        }
    } catch (e) {
        // Not deployed yet, continue
    }

    // Deploy message
    const deployBody = beginCell()
        .store(storeDeploy({ $$type: 'Deploy', queryId: 0n }))
        .endCell();

    // Send deploy transaction
    console.log('  Sending deploy transaction...');
    await sender.send({
        to: contractAddress,
        value: toNano('0.5'),
        bounce: false,
        body: deployBody,
        init: oracleResolver.init,
    });

    // Wait for deployment
    const deployed = await waitForDeploy(client, contractAddress);
    if (!deployed) {
        throw new Error('OracleResolver deployment failed');
    }

    return contractAddress;
}

async function deployMarketFactory(
    client: TonClient,
    wallet: OpenedContract<WalletContractV5R1>,
    sender: Sender,
    oracleResolverAddress: Address
): Promise<Address> {
    console.log('\n=== Deploying MarketFactory ===');
    console.log(`Oracle Registry: ${oracleResolverAddress.toString()}`);

    // Create MarketFactory instance
    const marketFactory = await MarketFactory.fromInit(oracleResolverAddress);
    const contractAddress = marketFactory.address;

    console.log(`Expected Address: ${contractAddress.toString()}`);

    // Check if already deployed
    try {
        const state = await client.getContractState(contractAddress);
        if (state.state === 'active') {
            console.log('MarketFactory already deployed!');
            return contractAddress;
        }
    } catch (e) {
        // Not deployed yet, continue
    }

    // Deploy message
    const deployBody = beginCell()
        .store(storeDeploy({ $$type: 'Deploy', queryId: 0n }))
        .endCell();

    // Send deploy transaction
    console.log('  Sending deploy transaction...');
    await sender.send({
        to: contractAddress,
        value: toNano('0.5'),
        bounce: false,
        body: deployBody,
        init: marketFactory.init,
    });

    // Wait for deployment
    const deployed = await waitForDeploy(client, contractAddress);
    if (!deployed) {
        throw new Error('MarketFactory deployment failed');
    }

    return contractAddress;
}

async function setupOracle(
    client: TonClient,
    wallet: OpenedContract<WalletContractV5R1>,
    sender: Sender,
    oracleResolverAddress: Address
): Promise<void> {
    console.log('\n=== Setting up Oracle ===');

    // Convert to @ton/core Address
    const deployerAddress = Address.parse(wallet.address.toString());
    console.log(`Adding deployer as reporter: ${deployerAddress.toString()}`);

    // Add reporter message
    const addReporterBody = beginCell()
        .store(storeAddReporter({
            $$type: 'AddReporter',
            reporter: deployerAddress,
            name: 'Primary Reporter',
            sourceType: 1n, // 1 = Primary source
        }))
        .endCell();

    await sender.send({
        to: oracleResolverAddress,
        value: toNano('0.1'),
        bounce: true,
        body: addReporterBody,
    });

    console.log('  AddReporter transaction sent');
    await sleep(10000); // Wait for transaction to process
    console.log('  Reporter added successfully');
}

async function createTestMarket(
    client: TonClient,
    wallet: OpenedContract<WalletContractV5R1>,
    sender: Sender,
    marketFactoryAddress: Address,
    oracleResolverAddress: Address
): Promise<void> {
    console.log('\n=== Creating Test Market ===');

    // Convert to @ton/core Address
    const deployerAddress = Address.parse(wallet.address.toString());

    // Build CreateMarket message
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setUTCHours(12, 0, 0, 0);
    const expiryTimestamp = BigInt(Math.floor(tomorrow.getTime() / 1000));

    const createMarketBody = beginCell()
        .store(storeCreateMarket({
            $$type: 'CreateMarket',
            eventDescription: 'Test Market: Will temperature exceed 20C tomorrow?',
            locationId: 2001n, // NYC
            expiryTimestamp: expiryTimestamp,
            oracleAddress: oracleResolverAddress,
            marketType: 0n, // Binary
            resolutionCriteria: 'temp_high > 200',
            creator: deployerAddress,
        }))
        .endCell();

    console.log(`  Sending CreateMarket transaction to ${marketFactoryAddress.toString()}...`);
    console.log(`  Oracle: ${oracleResolverAddress.toString()}`);
    console.log(`  Creator: ${deployerAddress.toString()}`);

    await sender.send({
        to: marketFactoryAddress,
        value: toNano('0.5'),
        bounce: true,
        body: createMarketBody,
    });

    console.log('  CreateMarket transaction sent');
    await sleep(15000); // Wait for transaction to process
    console.log('  ✓ Test market created successfully!');
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║       Whether - TON Contract Deployment Script           ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    // Parse command line args
    const args = process.argv.slice(2);
    const freshDeploy = args.includes('--fresh');
    const createMarket = args.includes('--create-market');

    if (freshDeploy) {
        console.log('\n⚠️  FRESH DEPLOYMENT MODE - Ignoring existing contract addresses');
    }

    // Load environment
    const mnemonic = process.env.MNEMONIC || process.env.DEPLOYER_MNEMONIC;
    const network = process.env.NETWORK || 'testnet';
    const existingOracleAddress = freshDeploy ? undefined : process.env.ORACLE_RESOLVER_ADDRESS;
    const existingFactoryAddress = freshDeploy ? undefined : process.env.MARKET_FACTORY_ADDRESS;

    if (!mnemonic) {
        console.error('Error: MNEMONIC not found in .env file');
        console.error('Copy .env.example to .env and add your 24-word mnemonic');
        process.exit(1);
    }

    const mnemonicArray = mnemonic.split(' ').filter(w => w.length > 0);
    if (mnemonicArray.length !== 24) {
        console.error(`Error: Mnemonic must be 24 words, got ${mnemonicArray.length}`);
        process.exit(1);
    }

    console.log(`\nNetwork: ${network.toUpperCase()}`);

    // Create client with optional API key
    const endpoint = network === 'mainnet' ? MAINNET_ENDPOINT : TESTNET_ENDPOINT;
    const apiKey = process.env.TONCENTER_API_KEY;
    const client = new TonClient({ endpoint, apiKey });

    // Create wallet from mnemonic
    console.log('\nLoading wallet from mnemonic...');
    const keyPair = await mnemonicToPrivateKey(mnemonicArray);
    const wallet = client.open(WalletContractV5R1.create({
        workchain: 0,
        publicKey: keyPair.publicKey,
    }));

    console.log(`Wallet Address: ${wallet.address.toString()}`);

    // Check wallet balance
    try {
        const balance = await client.getBalance(wallet.address);
        console.log(`Wallet Balance: ${Number(balance) / 1e9} TON`);

        if (balance < toNano('2')) {
            console.warn('\nWarning: Low balance! Deployment requires ~2.7 TON');
            console.warn(`Please fund this address with testnet TON: ${wallet.address.toString()}`);
            console.warn('You can get testnet TON from: https://t.me/testgiver_ton_bot');
            process.exit(1);
        }
    } catch (e) {
        console.error('\nError checking wallet balance:', e);
        console.error(`Please fund this address with testnet TON: ${wallet.address.toString()}`);
        console.error('You can get testnet TON from: https://t.me/testgiver_ton_bot');
        process.exit(1);
    }

    // Create sender
    const sender = createSender(wallet, keyPair);

    // Deploy OracleResolver
    let oracleResolverAddress: Address;
    if (existingOracleAddress) {
        console.log('\n=== Using existing OracleResolver ===');
        oracleResolverAddress = Address.parse(existingOracleAddress);
        console.log(`Address: ${oracleResolverAddress.toString()}`);
    } else {
        oracleResolverAddress = await deployOracleResolver(client, wallet, sender);
    }

    // Wait between deployments (longer to avoid rate limiting)
    await sleep(15000);

    // Deploy MarketFactory
    let marketFactoryAddress: Address;
    if (existingFactoryAddress) {
        console.log('\n=== Using existing MarketFactory ===');
        marketFactoryAddress = Address.parse(existingFactoryAddress);
        console.log(`Address: ${marketFactoryAddress.toString()}`);
    } else {
        marketFactoryAddress = await deployMarketFactory(client, wallet, sender, oracleResolverAddress);
    }

    // Setup Oracle (add deployer as reporter)
    if (!existingOracleAddress) {
        await sleep(5000);
        await setupOracle(client, wallet, sender, oracleResolverAddress);
    }

    // Create test market if requested
    if (createMarket) {
        await sleep(10000);
        await createTestMarket(client, wallet, sender, marketFactoryAddress, oracleResolverAddress);
    }

    // Print summary
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                 DEPLOYMENT COMPLETE                       ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('\nContract Addresses (update your .env file):');
    console.log(`  ORACLE_RESOLVER_ADDRESS=${oracleResolverAddress.toString()}`);
    console.log(`  MARKET_FACTORY_ADDRESS=${marketFactoryAddress.toString()}`);
    console.log('\nVerify on TON Explorer:');
    const explorerBase = network === 'mainnet' ? 'https://tonviewer.com' : 'https://testnet.tonviewer.com';
    console.log(`  OracleResolver: ${explorerBase}/${oracleResolverAddress.toString()}`);
    console.log(`  MarketFactory: ${explorerBase}/${marketFactoryAddress.toString()}`);
    console.log('\nUsage:');
    console.log('  npx tsx deploy.ts                    # Use existing contracts or deploy new');
    console.log('  npx tsx deploy.ts --fresh            # Force fresh deployment');
    console.log('  npx tsx deploy.ts --create-market    # Also create a test market');
    console.log('  npx tsx deploy.ts --fresh --create-market  # Full fresh setup');
}

main().catch(console.error);
