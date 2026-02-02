/**
 * Whether Wallet Generator
 *
 * Generates a new TON wallet for deploying contracts and signing oracle data.
 *
 * Usage:
 *   npx tsx scripts/generateWallet.ts [--purpose <purpose>]
 *
 * Options:
 *   --purpose <purpose>  Purpose of the wallet (deployer, oracle). Defaults to 'general'
 *
 * Output:
 *   - Wallet address (user-friendly and raw)
 *   - 24-word mnemonic (for DEPLOYER_MNEMONIC)
 *   - Private key hex (for ORACLE_SIGNER_KEY)
 *   - Public key hex
 *
 * IMPORTANT: Save the mnemonic and private key securely. They cannot be recovered!
 */

import { mnemonicNew, mnemonicToPrivateKey, KeyPair } from '@ton/crypto';
import { WalletContractV5R1 } from '@ton/ton';

interface WalletInfo {
    purpose: string;
    mnemonic: string[];
    publicKeyHex: string;
    secretKeyHex: string;
    addressRaw: string;
    addressUserFriendly: string;
    addressTestnet: string;
}

async function generateWallet(purpose: string = 'general'): Promise<WalletInfo> {
    // Generate new 24-word mnemonic
    const mnemonic = await mnemonicNew(24);

    // Derive key pair from mnemonic
    const keyPair: KeyPair = await mnemonicToPrivateKey(mnemonic);

    // Create W5 wallet contract
    const wallet = WalletContractV5R1.create({
        publicKey: keyPair.publicKey,
        workchain: 0,
    });

    return {
        purpose,
        mnemonic,
        publicKeyHex: keyPair.publicKey.toString('hex'),
        secretKeyHex: keyPair.secretKey.toString('hex'),
        addressRaw: wallet.address.toRawString(),
        addressUserFriendly: wallet.address.toString({ bounceable: false }),
        addressTestnet: wallet.address.toString({ bounceable: false, testOnly: true }),
    };
}

function printWalletInfo(info: WalletInfo): void {
    console.log('');
    console.log('='.repeat(70));
    console.log(`  TON WALLET GENERATED - Purpose: ${info.purpose.toUpperCase()}`);
    console.log('='.repeat(70));
    console.log('');

    console.log('ADDRESSES:');
    console.log('-'.repeat(70));
    console.log(`  Raw:            ${info.addressRaw}`);
    console.log(`  User-friendly:  ${info.addressUserFriendly}`);
    console.log(`  Testnet:        ${info.addressTestnet}`);
    console.log('');

    console.log('MNEMONIC (24 words - SAVE SECURELY!):');
    console.log('-'.repeat(70));
    console.log(`  ${info.mnemonic.join(' ')}`);
    console.log('');

    console.log('KEYS:');
    console.log('-'.repeat(70));
    console.log(`  Public Key:     ${info.publicKeyHex}`);
    console.log(`  Secret Key:     ${info.secretKeyHex.substring(0, 64)}...`);
    console.log('');

    console.log('ENVIRONMENT VARIABLES:');
    console.log('-'.repeat(70));

    if (info.purpose === 'deployer' || info.purpose === 'general') {
        console.log('  # For deploying contracts and creating markets:');
        console.log(`  DEPLOYER_MNEMONIC="${info.mnemonic.join(' ')}"`);
        console.log('');
    }

    if (info.purpose === 'oracle' || info.purpose === 'general') {
        console.log('  # For oracle signing:');
        console.log(`  ORACLE_SIGNER_KEY=${info.secretKeyHex}`);
        console.log(`  ORACLE_SIGNER_ADDRESS=${info.addressUserFriendly}`);
        console.log('');
    }

    console.log('NEXT STEPS:');
    console.log('-'.repeat(70));
    console.log('  1. SAVE the mnemonic and keys somewhere secure');
    console.log('  2. Fund the wallet with testnet TON:');
    console.log('     - Use @testgiver_ton_bot on Telegram');
    console.log('     - Or request from https://t.me/testnetTonBot');
    console.log(`     - Send to: ${info.addressTestnet}`);
    console.log('  3. Add environment variables to .env.prod');

    if (info.purpose === 'oracle') {
        console.log('  4. Register as oracle reporter:');
        console.log('     cd contracts && npx blueprint run setupOracle');
    } else if (info.purpose === 'deployer') {
        console.log('  4. Create initial markets:');
        console.log('     cd contracts && npx tsx scripts/dailyMarketGenerator.ts --dry-run');
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('');
}

function printEnvFormat(info: WalletInfo): void {
    console.log('');
    console.log('# Add to .env.prod:');
    console.log('');

    if (info.purpose === 'deployer' || info.purpose === 'general') {
        console.log(`DEPLOYER_MNEMONIC="${info.mnemonic.join(' ')}"`);
    }

    if (info.purpose === 'oracle' || info.purpose === 'general') {
        console.log(`ORACLE_SIGNER_KEY=${info.secretKeyHex}`);
        console.log(`ORACLE_SIGNER_ADDRESS=${info.addressUserFriendly}`);
    }
    console.log('');
}

// CLI argument parsing
function parseArgs(): { purpose: string; envFormat: boolean } {
    const args = process.argv.slice(2);
    let purpose = 'general';
    let envFormat = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if ((arg === '--purpose' || arg === '-p') && args[i + 1]) {
            purpose = args[++i];
            if (!['deployer', 'oracle', 'general'].includes(purpose)) {
                console.error(`Invalid purpose: ${purpose}. Must be one of: deployer, oracle, general`);
                process.exit(1);
            }
        } else if (arg === '--env') {
            envFormat = true;
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
Whether Wallet Generator

Usage: npx tsx scripts/generateWallet.ts [options]

Options:
  --purpose, -p <purpose>  Purpose of the wallet (deployer, oracle, general). Default: general
  --env                    Output only environment variable format
  --help, -h               Show this help message

Examples:
  # Generate a deployer wallet
  npx tsx scripts/generateWallet.ts --purpose deployer

  # Generate an oracle signer wallet
  npx tsx scripts/generateWallet.ts --purpose oracle

  # Generate and output only env format
  npx tsx scripts/generateWallet.ts --purpose oracle --env
            `);
            process.exit(0);
        }
    }

    return { purpose, envFormat };
}

// Main execution
async function main(): Promise<void> {
    const { purpose, envFormat } = parseArgs();

    console.log(`Generating ${purpose} wallet...`);

    const walletInfo = await generateWallet(purpose);

    if (envFormat) {
        printEnvFormat(walletInfo);
    } else {
        printWalletInfo(walletInfo);
    }
}

main().catch(error => {
    console.error('Error generating wallet:', error);
    process.exit(1);
});
