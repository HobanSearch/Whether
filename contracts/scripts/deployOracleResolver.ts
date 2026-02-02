import { toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { OracleResolver } from '../wrappers/OracleResolver';

// Contract funding configuration
const DEPLOY_VALUE = toNano('0.5');           // Covers deployment gas costs
const INITIAL_OPERATING_BALANCE = toNano('2'); // Operating funds for processing messages

export async function run(provider: NetworkProvider) {
    // Use the deployer wallet as the proxy admin
    const deployerAddress = provider.sender().address;
    if (!deployerAddress) {
        throw new Error('Deployer address not available');
    }

    console.log('Deploying OracleResolver...');
    console.log('Proxy Admin:', deployerAddress.toString());
    console.log('Deploy value:', DEPLOY_VALUE.toString(), 'nanoTON');
    console.log('Initial operating balance:', INITIAL_OPERATING_BALANCE.toString(), 'nanoTON');

    const oracleResolver = provider.open(
        await OracleResolver.fromInit(deployerAddress)
    );

    // Step 1: Deploy the contract
    await oracleResolver.send(
        provider.sender(),
        {
            value: DEPLOY_VALUE,
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(oracleResolver.address);

    console.log('Contract deployed, funding with operating balance...');

    // Step 2: Fund the contract with operating balance
    await provider.sender().send({
        to: oracleResolver.address,
        value: INITIAL_OPERATING_BALANCE,
        bounce: false,
    });

    // Wait a moment for the funding transaction to process
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('');
    console.log('='.repeat(60));
    console.log('OracleResolver deployed and funded successfully!');
    console.log('Address:', oracleResolver.address.toString());
    console.log('Initial funding:', Number(INITIAL_OPERATING_BALANCE) / 1e9, 'TON');
    console.log('='.repeat(60));
    console.log('');
    console.log('Save this address for MarketFactory deployment:');
    console.log(`ORACLE_RESOLVER_ADDRESS=${oracleResolver.address.toString()}`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Run: npx blueprint run deployMarketFactory');
    console.log('2. Add reporter: npx blueprint run setupOracle');
}
