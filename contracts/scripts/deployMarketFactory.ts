import { Address, toNano, internal } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { MarketFactory } from '../wrappers/MarketFactory';

// Contract funding configuration
// These values ensure contracts have sufficient operating balance after deployment
const DEPLOY_VALUE = toNano('0.5');           // Covers deployment gas costs
const INITIAL_OPERATING_BALANCE = toNano('3'); // Operating funds for processing messages

export async function run(provider: NetworkProvider) {
    // Prompt for OracleResolver address
    const oracleAddress = await provider.ui().input(
        'Enter the OracleResolver address (from previous deployment):'
    );

    if (!oracleAddress) {
        throw new Error('OracleResolver address is required');
    }

    let oracleResolverAddress: Address;
    try {
        oracleResolverAddress = Address.parse(oracleAddress);
    } catch (e) {
        throw new Error(`Invalid address format: ${oracleAddress}`);
    }

    console.log('');
    console.log('Deploying MarketFactory...');
    console.log('Oracle Registry:', oracleResolverAddress.toString());
    console.log('Deploy value:', DEPLOY_VALUE.toString(), 'nanoTON');
    console.log('Initial operating balance:', INITIAL_OPERATING_BALANCE.toString(), 'nanoTON');

    const marketFactory = provider.open(
        await MarketFactory.fromInit(oracleResolverAddress)
    );

    // Step 1: Deploy the contract
    await marketFactory.send(
        provider.sender(),
        {
            value: DEPLOY_VALUE,
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(marketFactory.address);

    console.log('Contract deployed, funding with operating balance...');

    // Step 2: Fund the contract with operating balance
    // This ensures the contract can process incoming messages and deploy markets
    await provider.sender().send({
        to: marketFactory.address,
        value: INITIAL_OPERATING_BALANCE,
        bounce: false,
    });

    // Wait a moment for the funding transaction to process
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('');
    console.log('='.repeat(60));
    console.log('MarketFactory deployed and funded successfully!');
    console.log('Address:', marketFactory.address.toString());
    console.log('Initial funding:', Number(INITIAL_OPERATING_BALANCE) / 1e9, 'TON');
    console.log('='.repeat(60));
    console.log('');
    console.log('Contract addresses for .env:');
    console.log(`ORACLE_RESOLVER_ADDRESS=${oracleResolverAddress.toString()}`);
    console.log(`MARKET_FACTORY_ADDRESS=${marketFactory.address.toString()}`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Run: npx blueprint run setupOracle');
    console.log('2. Create initial markets: npx blueprint run createMarkets');
    console.log('');
    console.log('Note: The factory has been funded with', Number(INITIAL_OPERATING_BALANCE) / 1e9, 'TON');
    console.log('for processing CreateMarket messages and deploying markets.');
}
