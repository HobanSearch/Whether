import { WalletContractV5R1, WalletContractV4 } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';

const mnemonic = "prefer keep become wolf way submit mouse surge retire dumb chest deny track hip toe affair axis theme cram replace remind purity huge dirt";

async function main() {
    const keyPair = await mnemonicToPrivateKey(mnemonic.split(' '));

    const walletV5 = WalletContractV5R1.create({
        publicKey: keyPair.publicKey,
        workchain: 0,
    });

    const walletV4 = WalletContractV4.create({
        publicKey: keyPair.publicKey,
        workchain: 0,
    });

    console.log("Mnemonic:", mnemonic.split(' ').slice(0, 3).join(' ') + '...');
    console.log("\nV5R1 (W5) Address:", walletV5.address.toString());
    console.log("V5R1 Raw:", walletV5.address.toRawString());
    console.log("\nV4R2 Address:", walletV4.address.toString());
    console.log("V4R2 Raw:", walletV4.address.toRawString());

    console.log("\nYour funded wallet: 0QBkg6JGZ3m_JCyJy0DBKcR8A_fo8wel-NqWKlIBg6yi7IR2");
}

main().catch(console.error);
