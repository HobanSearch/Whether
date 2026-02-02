import { Address, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { OracleResolver } from '../wrappers/OracleResolver';

export async function run(provider: NetworkProvider) {
    // Prompt for OracleResolver address
    const oracleAddress = await provider.ui().input(
        'Enter the OracleResolver address:'
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

    const oracleResolver = provider.open(
        OracleResolver.fromAddress(oracleResolverAddress)
    );

    // Get deployer address for reporter/arbitrator setup
    const deployerAddress = provider.sender().address;
    if (!deployerAddress) {
        throw new Error('Deployer address not available');
    }

    console.log('');
    console.log('Setting up OracleResolver...');
    console.log('Oracle Address:', oracleResolverAddress.toString());
    console.log('');

    // Add deployer as initial reporter (for testing)
    console.log('Adding deployer as initial reporter...');
    await oracleResolver.send(
        provider.sender(),
        {
            value: toNano('0.1'),
        },
        {
            $$type: 'AddReporter',
            reporter: deployerAddress,
            name: 'Admin Reporter',
            sourceType: 0n, // 0 = manual, 1 = API, 2 = METAR
        }
    );

    // Wait a bit for the transaction
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Add deployer as initial arbitrator (for testing)
    console.log('Adding deployer as initial arbitrator...');
    await oracleResolver.send(
        provider.sender(),
        {
            value: toNano('0.1'),
        },
        {
            $$type: 'AddArbitrator',
            arbitrator: deployerAddress,
            name: 'Admin Arbitrator',
            weight: 100n,
        }
    );

    console.log('');
    console.log('='.repeat(60));
    console.log('Oracle setup complete!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Reporter added:', deployerAddress.toString());
    console.log('Arbitrator added:', deployerAddress.toString());
    console.log('');
    console.log('Next steps:');
    console.log('1. Create initial markets: npx blueprint run createMarkets');
    console.log('2. (Optional) Add oracle bot as reporter');
    console.log('');
    console.log('To add additional reporters later, call AddReporter with:');
    console.log('- reporter: <address>');
    console.log('- name: <string>');
    console.log('- sourceType: 0=manual, 1=API, 2=METAR');
}
