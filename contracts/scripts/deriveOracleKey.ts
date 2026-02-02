/**
 * Derive Oracle Signer Key from Mnemonic
 *
 * This script derives the private key (hex) and address from the existing
 * wallet mnemonic for use with the Oracle service.
 *
 * Usage:
 *   npx tsx scripts/deriveOracleKey.ts
 *
 * Output:
 *   Environment variables to add to .env.prod
 */

import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV5R1 } from '@ton/ton';
import * as dotenv from 'dotenv';

dotenv.config();

async function main(): Promise<void> {
    const mnemonic = process.env.MNEMONIC || process.env.DEPLOYER_MNEMONIC;

    if (!mnemonic) {
        console.error('Error: No mnemonic found in environment');
        console.error('Set MNEMONIC or DEPLOYER_MNEMONIC in .env file');
        process.exit(1);
    }

    console.log('Deriving oracle signer credentials from mnemonic (W5 wallet)...\n');

    // Derive key pair from mnemonic
    const keyPair = await mnemonicToPrivateKey(mnemonic.split(' '));

    // Create W5 wallet contract to get address
    const wallet = WalletContractV5R1.create({
        publicKey: keyPair.publicKey,
        workchain: 0,
    });

    const secretKeyHex = keyPair.secretKey.toString('hex');
    const addressUserFriendly = wallet.address.toString({ bounceable: false });
    const addressTestnet = wallet.address.toString({ bounceable: false, testOnly: true });

    console.log('='.repeat(70));
    console.log('  ORACLE SIGNER CREDENTIALS');
    console.log('='.repeat(70));
    console.log('');
    console.log('Wallet Address:');
    console.log(`  Mainnet: ${addressUserFriendly}`);
    console.log(`  Testnet: ${addressTestnet}`);
    console.log('');
    console.log('-'.repeat(70));
    console.log('Add these lines to .env.prod:');
    console.log('-'.repeat(70));
    console.log('');
    console.log(`ORACLE_SIGNER_KEY=${secretKeyHex}`);
    console.log(`ORACLE_SIGNER_ADDRESS=${addressUserFriendly}`);
    console.log('');
    console.log('='.repeat(70));
}

main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
