import { Address, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';

/**
 * Fund a contract with TON
 *
 * Usage: npx blueprint run fundContract
 *
 * This script sends TON to a contract address to ensure it has sufficient
 * operating balance for processing messages. Contracts need a minimum balance
 * to pay for gas when receiving and processing messages.
 *
 * Recommended balances:
 * - MarketFactory: 3-5 TON (deploys markets, processes CreateMarket)
 * - OracleResolver: 2-3 TON (processes weather data submissions)
 * - PredictionMarket: 1-2 TON (processes bets, settlements)
 */

const DEFAULT_AMOUNTS: Record<string, bigint> = {
    factory: toNano('3'),
    oracle: toNano('2'),
    market: toNano('1'),
};

export async function run(provider: NetworkProvider) {
    // Get contract address
    const addressInput = await provider.ui().input(
        'Enter the contract address to fund:'
    );

    if (!addressInput) {
        throw new Error('Contract address is required');
    }

    let contractAddress: Address;
    try {
        contractAddress = Address.parse(addressInput);
    } catch (e) {
        throw new Error(`Invalid address format: ${addressInput}`);
    }

    // Get amount to send
    const contractType = await provider.ui().choose(
        'Select contract type (determines default amount):',
        ['factory (3 TON)', 'oracle (2 TON)', 'market (1 TON)', 'custom'],
        (v) => v
    );

    let amount: bigint;
    if (contractType === 'custom') {
        const amountInput = await provider.ui().input(
            'Enter amount in TON (e.g., 2.5):'
        );
        amount = toNano(amountInput);
    } else {
        const type = contractType.split(' ')[0] as keyof typeof DEFAULT_AMOUNTS;
        amount = DEFAULT_AMOUNTS[type];
    }

    console.log('');
    console.log('Funding contract...');
    console.log('Address:', contractAddress.toString());
    console.log('Amount:', Number(amount) / 1e9, 'TON');

    // Send the funds
    await provider.sender().send({
        to: contractAddress,
        value: amount,
        bounce: false, // Don't bounce if contract doesn't exist
    });

    console.log('');
    console.log('='.repeat(60));
    console.log('Funding transaction sent!');
    console.log('='.repeat(60));
    console.log('');
    console.log('The contract should receive the funds within a few seconds.');
    console.log('You can verify the balance on TON Explorer:');
    console.log(`https://testnet.tonviewer.com/${contractAddress.toString()}`);
}
