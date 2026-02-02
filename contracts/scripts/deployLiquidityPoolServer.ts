/**
 * Whether Liquidity Pool Deployment Script (Server-side)
 *
 * Deploys the LiquidityPool and LP Token contracts to testnet.
 * Uses Tact-generated wrappers - contracts must be built first.
 *
 * PREREQUISITE: Build contracts locally before running on server:
 *   npx blueprint build LiquidityPool
 *   npx blueprint build LPTokenMaster
 *
 * Then copy the build folder to the server.
 *
 * Usage:
 *   npx tsx scripts/deployLiquidityPoolServer.ts [--dry-run]
 *
 * Environment Variables:
 *   DEPLOYER_MNEMONIC - Mnemonic for the deployer wallet
 *   TON_ENDPOINT - TON API endpoint (default: testnet)
 *   TONCENTER_API_KEY - Optional API key for higher rate limits
 *   MARKET_FACTORY_ADDRESS - Address of the deployed MarketFactory (optional)
 */

import { TonClient, WalletContractV5R1 } from '@ton/ton';
import { Address, toNano, OpenedContract, internal, beginCell, Cell, contractAddress } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import * as dotenv from 'dotenv';

// Import from Tact-generated wrappers
// NOTE: Build contracts first with:
//   npx blueprint build LiquidityPool
//   npx blueprint build LPTokenMaster
import {
    LiquidityPool,
    LiquidityPoolInit,
} from '../build/LiquidityPool/tact_LiquidityPool';

import {
    LPTokenMaster,
} from '../build/LPTokenMaster/tact_LPTokenMaster';

dotenv.config();

// Sleep utility
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry utility for flaky testnet API
async function withRetry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 5,
    delayMs: number = 10000,
    description: string = 'operation'
): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const isRetryable = lastError.message.includes('500') ||
                               lastError.message.includes('429') ||
                               lastError.message.includes('timeout') ||
                               lastError.message.includes('LITE_SERVER');

            if (attempt < maxAttempts && isRetryable) {
                console.log(`  ⚠ ${description} failed (attempt ${attempt}/${maxAttempts}): ${lastError.message}`);
                console.log(`  Retrying in ${delayMs / 1000}s...`);
                await sleep(delayMs);
            } else if (!isRetryable) {
                throw lastError;
            }
        }
    }
    throw lastError;
}

// Wait for seqno to change (transaction confirmed)
async function waitForSeqno(wallet: OpenedContract<WalletContractV5R1>, targetSeqno: number, maxWaitMs: number = 60000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
        try {
            const currentSeqno = await wallet.getSeqno();
            if (currentSeqno > targetSeqno) {
                return true;
            }
        } catch {
            // Ignore errors during polling
        }
        await sleep(5000);
    }
    return false;
}

// ============================================
// DEPLOYMENT CONFIGURATION
// ============================================

interface DeployConfig {
    tonEndpoint: string;
    deployerMnemonic: string;
    apiKey?: string;
    dryRun: boolean;
    factoryAddress?: string;
}

interface DeployedContracts {
    lpPoolAddress: string;
    lpTokenMasterAddress: string;
}

// ============================================
// MAIN DEPLOYMENT FUNCTION
// ============================================

async function deployLiquidityPool(config: DeployConfig): Promise<DeployedContracts | null> {
    console.log('\n' + '='.repeat(60));
    console.log('Whether Liquidity Pool Deployment');
    console.log('='.repeat(60));
    console.log('');

    if (config.dryRun) {
        console.log('*** DRY RUN MODE - No transactions will be sent ***\n');
    }

    // Initialize TON client
    const client = new TonClient({
        endpoint: config.tonEndpoint,
        apiKey: config.apiKey,
    });

    // Initialize W5 wallet
    const keyPair = await mnemonicToPrivateKey(config.deployerMnemonic.split(' '));
    const wallet = WalletContractV5R1.create({
        publicKey: keyPair.publicKey,
        workchain: 0,
    });
    const walletContract = client.open(wallet);
    const walletAddress = wallet.address;

    // Factory address (optional - can use deployer if not specified)
    const factoryAddress = config.factoryAddress
        ? Address.parse(config.factoryAddress)
        : walletAddress;

    console.log(`Deployer wallet: ${walletAddress.toString()}`);
    console.log(`Factory address: ${factoryAddress.toString()}`);
    console.log(`TON endpoint: ${config.tonEndpoint}`);
    console.log('');

    // Check wallet balance
    console.log('Checking wallet balance...');
    const balance = await withRetry(
        () => walletContract.getBalance(),
        5,
        10000,
        'getBalance'
    );
    console.log(`Wallet balance: ${Number(balance) / 1e9} TON`);

    const requiredBalance = toNano('3'); // Need ~3 TON for deployment (0.5 + 1 + 1 + gas)
    if (balance < requiredBalance) {
        console.error(`Insufficient balance. Need at least ${Number(requiredBalance) / 1e9} TON`);
        console.error('Fund the wallet with testnet TON first.');
        console.error('');
        console.error('Tip: You can lower the funding amount by editing the script.');
        process.exit(1);
    }

    // ============================================
    // Step 1: Compute addresses first (TON contracts are deterministic)
    // ============================================

    console.log('\n--- Computing contract addresses ---\n');

    // We need to solve the chicken-and-egg problem:
    // - LiquidityPool needs lpTokenMaster address
    // - LPTokenMaster needs liquidityPool address
    //
    // Solution: Compute both addresses first using placeholder values,
    // then deploy with correct addresses

    // Create LP Token metadata content
    const lpTokenContent = beginCell()
        .storeUint(0x01, 8) // on-chain metadata flag
        .storeStringTail('Whether LP Token')
        .endCell();

    // First, create LP Pool init with placeholder LP Token address
    // We'll compute the real address iteratively
    const lpPoolInitParams: LiquidityPoolInit = {
        $$type: 'LiquidityPoolInit',
        owner: walletAddress,
        lpTokenMaster: walletAddress, // Placeholder - will compute real address
        factoryAddress: factoryAddress,
    };

    // Get LP Pool code and compute its address
    const lpPool = await LiquidityPool.fromInit(lpPoolInitParams);
    const lpPoolAddress = lpPool.address;
    console.log(`LiquidityPool address: ${lpPoolAddress.toString()}`);

    // Now create LP Token with the real LP Pool address
    const lpToken = await LPTokenMaster.fromInit(
        walletAddress,      // owner
        lpPoolAddress,      // liquidityPool
        lpTokenContent      // content
    );
    const lpTokenAddress = lpToken.address;
    console.log(`LPTokenMaster address: ${lpTokenAddress.toString()}`);

    // Re-compute LP Pool with correct LP Token address
    const lpPoolFinalParams: LiquidityPoolInit = {
        $$type: 'LiquidityPoolInit',
        owner: walletAddress,
        lpTokenMaster: lpTokenAddress,
        factoryAddress: factoryAddress,
    };
    const lpPoolFinal = await LiquidityPool.fromInit(lpPoolFinalParams);
    const lpPoolFinalAddress = lpPoolFinal.address;
    console.log(`LiquidityPool (final) address: ${lpPoolFinalAddress.toString()}`);

    // Re-compute LP Token with the final LP Pool address
    const lpTokenFinal = await LPTokenMaster.fromInit(
        walletAddress,
        lpPoolFinalAddress,
        lpTokenContent
    );
    const lpTokenFinalAddress = lpTokenFinal.address;
    console.log(`LPTokenMaster (final) address: ${lpTokenFinalAddress.toString()}`);

    if (config.dryRun) {
        console.log('\n*** DRY RUN COMPLETE ***');
        console.log('\nWould deploy:');
        console.log(`  1. LPTokenMaster:   ${lpTokenFinalAddress.toString()}`);
        console.log(`  2. LiquidityPool:   ${lpPoolFinalAddress.toString()}`);
        console.log('\nRun without --dry-run to deploy.');
        return null;
    }

    // ============================================
    // Step 2: Deploy LP Token Master
    // ============================================

    console.log('\n--- Step 1: Deploy LP Token Master ---\n');

    try {
        const seqno1 = await withRetry(
            () => walletContract.getSeqno(),
            5,
            5000,
            'getSeqno for LP Token'
        );
        console.log(`Current seqno: ${seqno1}`);

        // Build the Deploy message body
        const deployMsgBody = beginCell()
            .storeUint(2490013878, 32) // Deploy opcode
            .storeUint(0, 64)          // queryId
            .endCell();

        // Send deployment transaction
        console.log('Sending LP Token deployment transaction...');
        await withRetry(
            () => walletContract.sendTransfer({
                seqno: seqno1,
                secretKey: keyPair.secretKey,
                messages: [internal({
                    to: lpTokenFinalAddress,
                    value: toNano('0.5'),
                    bounce: false,
                    init: lpTokenFinal.init,
                    body: deployMsgBody,
                })],
            }),
            3,
            10000,
            'deploy LP Token'
        );

        console.log('Waiting for confirmation...');
        const confirmed1 = await waitForSeqno(walletContract, seqno1, 60000);
        if (confirmed1) {
            console.log('✓ LP Token Master deployed!');
        } else {
            console.log('⚠ Confirmation timeout (tx may still succeed)');
        }

        await sleep(5000); // Wait for state to propagate

        // ============================================
        // Step 3: Deploy Liquidity Pool
        // ============================================

        console.log('\n--- Step 2: Deploy Liquidity Pool ---\n');

        const seqno2 = await withRetry(
            () => walletContract.getSeqno(),
            5,
            5000,
            'getSeqno for LP Pool'
        );
        console.log(`Current seqno: ${seqno2}`);

        // Send deployment transaction
        console.log('Sending Liquidity Pool deployment transaction...');
        await withRetry(
            () => walletContract.sendTransfer({
                seqno: seqno2,
                secretKey: keyPair.secretKey,
                messages: [internal({
                    to: lpPoolFinalAddress,
                    value: toNano('1'), // Initial balance for operations
                    bounce: false,
                    init: lpPoolFinal.init,
                    body: deployMsgBody,
                })],
            }),
            3,
            10000,
            'deploy LP Pool'
        );

        console.log('Waiting for confirmation...');
        const confirmed2 = await waitForSeqno(walletContract, seqno2, 60000);
        if (confirmed2) {
            console.log('✓ Liquidity Pool deployed!');
        } else {
            console.log('⚠ Confirmation timeout (tx may still succeed)');
        }

        await sleep(5000);

        // ============================================
        // Step 4: Fund the pool with initial operating balance
        // ============================================

        console.log('\n--- Step 3: Fund pool with operating balance ---\n');

        const seqno3 = await withRetry(
            () => walletContract.getSeqno(),
            5,
            5000,
            'getSeqno for funding'
        );
        console.log(`Current seqno: ${seqno3}`);

        console.log('Sending 1 TON operating balance to pool...');
        await withRetry(
            () => walletContract.sendTransfer({
                seqno: seqno3,
                secretKey: keyPair.secretKey,
                messages: [internal({
                    to: lpPoolFinalAddress,
                    value: toNano('1'),
                    bounce: false,
                    body: beginCell().endCell(), // Empty message
                })],
            }),
            3,
            10000,
            'fund LP Pool'
        );

        console.log('Waiting for confirmation...');
        const confirmed3 = await waitForSeqno(walletContract, seqno3, 60000);
        if (confirmed3) {
            console.log('✓ Pool funded with operating balance!');
        } else {
            console.log('⚠ Confirmation timeout (tx may still succeed)');
        }

        // ============================================
        // Summary
        // ============================================

        console.log('\n' + '='.repeat(60));
        console.log('DEPLOYMENT COMPLETE!');
        console.log('='.repeat(60));
        console.log('');
        console.log('Deployed Contracts:');
        console.log(`  LP Token Master: ${lpTokenFinalAddress.toString()}`);
        console.log(`  Liquidity Pool:  ${lpPoolFinalAddress.toString()}`);
        console.log('');
        console.log('Next Steps:');
        console.log('1. Update /etc/whether/env with:');
        console.log(`   LIQUIDITY_POOL_ADDRESS=${lpPoolFinalAddress.toString()}`);
        console.log(`   LP_TOKEN_ADDRESS=${lpTokenFinalAddress.toString()}`);
        console.log('');
        console.log('2. Update docker-compose.prod.yml environment and restart:');
        console.log('   cd /opt/whether && docker-compose -f docker-compose.prod.yml up -d --build');
        console.log('');
        console.log('3. Verify on explorer:');
        console.log(`   https://testnet.tonscan.org/address/${lpPoolFinalAddress.toString()}`);
        console.log(`   https://testnet.tonscan.org/address/${lpTokenFinalAddress.toString()}`);
        console.log('');

        return {
            lpPoolAddress: lpPoolFinalAddress.toString(),
            lpTokenMasterAddress: lpTokenFinalAddress.toString(),
        };

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`\n✗ Deployment failed: ${errorMsg}`);
        console.error('\nTroubleshooting:');
        console.error('1. Make sure contracts are compiled first:');
        console.error('   npx blueprint build LiquidityPool');
        console.error('   npx blueprint build LPTokenMaster');
        console.error('2. Check wallet has sufficient balance');
        console.error('3. Try again - testnet can be flaky');
        process.exit(1);
    }
}

// ============================================
// CLI INTERFACE
// ============================================

function parseArgs(): { dryRun: boolean } {
    const argv = process.argv.slice(2);

    if (argv.includes('--help') || argv.includes('-h')) {
        console.log(`
Whether Liquidity Pool Deployment Script

Usage: npx tsx scripts/deployLiquidityPoolServer.ts [options]

Options:
  --dry-run    Print contract addresses without deploying
  --help, -h   Show this help message

PREREQUISITE: Build contracts locally first:
  npx blueprint build LiquidityPool
  npx blueprint build LPTokenMaster

Then copy the build folder to the server.

Environment Variables:
  DEPLOYER_MNEMONIC      Mnemonic for the deployer wallet (required)
  TON_ENDPOINT           TON API endpoint (default: testnet)
  TONCENTER_API_KEY      API key for higher rate limits (optional)
  MARKET_FACTORY_ADDRESS Address of deployed MarketFactory (optional)
        `);
        process.exit(0);
    }

    return {
        dryRun: argv.includes('--dry-run'),
    };
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main(): Promise<void> {
    const args = parseArgs();

    // Validate environment variables
    const deployerMnemonic = process.env.DEPLOYER_MNEMONIC;
    const tonEndpoint = process.env.TON_ENDPOINT || 'https://testnet.toncenter.com/api/v2/jsonRPC';
    const apiKey = process.env.TONCENTER_API_KEY;
    const factoryAddress = process.env.MARKET_FACTORY_ADDRESS;

    if (!deployerMnemonic) {
        console.error('Error: DEPLOYER_MNEMONIC environment variable not set');
        console.error('');
        console.error('On the server, source the env file first:');
        console.error('  . /etc/whether/env');
        console.error('');
        console.error('Or set it directly:');
        console.error('  export DEPLOYER_MNEMONIC="your mnemonic here"');
        process.exit(1);
    }

    await deployLiquidityPool({
        tonEndpoint,
        deployerMnemonic,
        apiKey,
        dryRun: args.dryRun,
        factoryAddress,
    });
}

// Run
main().catch(console.error);
