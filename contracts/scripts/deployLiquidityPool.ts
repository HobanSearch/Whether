import { Address, toNano, beginCell } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { LiquidityPool } from '../wrappers/LiquidityPool';
import { LPTokenMaster } from '../wrappers/LPTokenMaster';

const DEPLOY_VALUE = toNano('0.5');
const INITIAL_OPERATING_BALANCE = toNano('2');

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();

    console.log('');
    console.log('='.repeat(60));
    console.log('Deploying Liquidity Pool System');
    console.log('='.repeat(60));
    console.log('');

    const factoryAddressStr = await ui.input(
        'Enter the MarketFactory address (or leave empty for new deployment):'
    );

    let factoryAddress: Address;
    if (factoryAddressStr) {
        try {
            factoryAddress = Address.parse(factoryAddressStr);
        } catch (e) {
            throw new Error(`Invalid factory address: ${factoryAddressStr}`);
        }
    } else {
        factoryAddress = provider.sender().address!;
        console.log('No factory provided, using deployer as factory:', factoryAddress.toString());
    }

    const ownerAddress = provider.sender().address!;

    console.log('');
    console.log('Configuration:');
    console.log('Owner:', ownerAddress.toString());
    console.log('Factory:', factoryAddress.toString());
    console.log('Deploy value:', DEPLOY_VALUE.toString(), 'nanoTON');
    console.log('');

    const confirmDeploy = await ui.choose('Deploy LP system?', ['Yes', 'No'], (c) => c);
    if (confirmDeploy === 'No') {
        console.log('Deployment cancelled');
        return;
    }

    console.log('');
    console.log('Step 1: Creating LP Token metadata...');

    const lpTokenContent = beginCell()
        .storeUint(0x01, 8)
        .storeStringTail('https://whether.markets/lp-token.json')
        .endCell();

    console.log('');
    console.log('Step 2: Deploying LiquidityPool contract...');

    const liquidityPoolParams = {
        $$type: 'LiquidityPoolInit' as const,
        owner: ownerAddress,
        lpTokenMaster: ownerAddress,
        factoryAddress: factoryAddress,
    };

    const liquidityPool = provider.open(
        await LiquidityPool.fromInit(liquidityPoolParams)
    );

    await liquidityPool.send(
        provider.sender(),
        {
            value: DEPLOY_VALUE,
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(liquidityPool.address);

    console.log('LiquidityPool deployed at:', liquidityPool.address.toString());

    console.log('');
    console.log('Step 3: Deploying LPTokenMaster contract...');

    const lpTokenMaster = provider.open(
        await LPTokenMaster.fromInit(
            ownerAddress,
            liquidityPool.address,
            lpTokenContent
        )
    );

    await lpTokenMaster.send(
        provider.sender(),
        {
            value: DEPLOY_VALUE,
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(lpTokenMaster.address);

    console.log('LPTokenMaster deployed at:', lpTokenMaster.address.toString());

    console.log('');
    console.log('Step 4: Funding contracts with operating balance...');

    await provider.sender().send({
        to: liquidityPool.address,
        value: INITIAL_OPERATING_BALANCE,
        bounce: false,
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Funded LiquidityPool with', Number(INITIAL_OPERATING_BALANCE) / 1e9, 'TON');

    console.log('');
    console.log('='.repeat(60));
    console.log('Deployment Complete!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Contract Addresses:');
    console.log(`LIQUIDITY_POOL_ADDRESS=${liquidityPool.address.toString()}`);
    console.log(`LP_TOKEN_ADDRESS=${lpTokenMaster.address.toString()}`);
    console.log('');
    console.log('Add these to your .env file.');
    console.log('');
    console.log('Verify on explorer:');
    console.log(`LiquidityPool: https://testnet.tonscan.org/address/${liquidityPool.address.toString()}`);
    console.log(`LPTokenMaster: https://testnet.tonscan.org/address/${lpTokenMaster.address.toString()}`);
    console.log('');

    console.log('Fetching initial pool stats...');
    try {
        const stats = await liquidityPool.getGetPoolStats();
        console.log('Pool Stats:');
        console.log('  TVL:', stats.tvl.toString(), 'nanoTON');
        console.log('  Total Shares:', stats.totalShares.toString());
        console.log('  Share Price:', stats.sharePrice.toString());
        console.log('  LP Count:', stats.lpCount.toString());
    } catch (e) {
        console.log('Could not fetch stats (contract may still be initializing)');
    }

    console.log('');
    console.log('Next steps:');
    console.log('1. Register the LP pool with the MarketFactory');
    console.log('2. Deploy or update PredictionMarket contracts with LP pool address');
    console.log('3. Test deposit/withdraw functionality');
}
