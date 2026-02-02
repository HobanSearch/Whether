import { Address, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { MarketFactory } from '../wrappers/MarketFactory';

// Location IDs from the PRD
const LOCATIONS = {
    // Airports (1000-1999)
    JFK: 1001n,
    LAX: 1002n,
    ORD: 1003n,
    LHR: 1004n,
    CDG: 1005n,
    NRT: 1006n,
    DXB: 1007n,
    SIN: 1008n,
    SYD: 1009n,
    HKG: 1010n,
    // Cities (2000-2999)
    NYC: 2001n,
    London: 2002n,
    Tokyo: 2003n,
    Dubai: 2004n,
    Singapore: 2005n,
    Sydney: 2006n,
    Mumbai: 2007n,
    SaoPaulo: 2008n,
    Lagos: 2009n,
    Moscow: 2010n,
};

// Resolution types
const RESOLUTION_TYPES = {
    TEMP_HIGH: 0,  // Daily high temperature
    TEMP_LOW: 1,   // Daily low temperature
    PRECIPITATION: 2,
    VISIBILITY: 3,
    WIND_SPEED: 4,
    CONDITIONS: 5,
};

// Initial test markets for testnet launch
const INITIAL_MARKETS = [
    {
        description: 'NYC high temp > 50°F tomorrow',
        locationId: LOCATIONS.NYC,
        resolutionCriteria: 'temp_high > 100', // 10°C in tenths
        marketType: 0n, // Binary
    },
    {
        description: 'London high temp > 10°C tomorrow',
        locationId: LOCATIONS.London,
        resolutionCriteria: 'temp_high > 100',
        marketType: 0n,
    },
    {
        description: 'Tokyo precipitation > 0mm tomorrow',
        locationId: LOCATIONS.Tokyo,
        resolutionCriteria: 'precipitation > 0',
        marketType: 0n,
    },
    {
        description: 'Dubai high temp > 30°C tomorrow',
        locationId: LOCATIONS.Dubai,
        resolutionCriteria: 'temp_high > 300',
        marketType: 0n,
    },
    {
        description: 'Sydney high temp > 25°C tomorrow',
        locationId: LOCATIONS.Sydney,
        resolutionCriteria: 'temp_high > 250',
        marketType: 0n,
    },
];

export async function run(provider: NetworkProvider) {
    // Prompt for contract addresses
    const factoryAddress = await provider.ui().input(
        'Enter the MarketFactory address:'
    );
    const oracleAddress = await provider.ui().input(
        'Enter the OracleResolver address:'
    );

    if (!factoryAddress || !oracleAddress) {
        throw new Error('Both addresses are required');
    }

    let marketFactoryAddress: Address;
    let oracleResolverAddress: Address;
    try {
        marketFactoryAddress = Address.parse(factoryAddress);
        oracleResolverAddress = Address.parse(oracleAddress);
    } catch (e) {
        throw new Error('Invalid address format');
    }

    const deployerAddress = provider.sender().address;
    if (!deployerAddress) {
        throw new Error('Deployer address not available');
    }

    const marketFactory = provider.open(
        MarketFactory.fromAddress(marketFactoryAddress)
    );

    console.log('');
    console.log('Creating initial markets...');
    console.log('Factory:', marketFactoryAddress.toString());
    console.log('Oracle:', oracleResolverAddress.toString());
    console.log('');

    // Calculate expiry for tomorrow at midnight UTC
    const now = Math.floor(Date.now() / 1000);
    const tomorrowMidnight = Math.floor(now / 86400) * 86400 + 86400 + 43200; // Tomorrow noon UTC

    for (let i = 0; i < INITIAL_MARKETS.length; i++) {
        const market = INITIAL_MARKETS[i];
        console.log(`Creating market ${i + 1}/${INITIAL_MARKETS.length}: ${market.description}`);

        await marketFactory.send(
            provider.sender(),
            {
                value: toNano('0.3'), // Enough for market deployment
            },
            {
                $$type: 'CreateMarket',
                eventDescription: market.description,
                locationId: market.locationId,
                expiryTimestamp: BigInt(tomorrowMidnight),
                oracleAddress: oracleResolverAddress,
                marketType: market.marketType,
                resolutionCriteria: market.resolutionCriteria,
                creator: deployerAddress,
            }
        );

        // Wait between deployments
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('Initial markets created!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Markets created:');
    INITIAL_MARKETS.forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.description}`);
    });
    console.log('');
    console.log('To view market addresses, query MarketFactory.getMarketAddress(1..5)');
    console.log('');
    console.log('Whether is now ready for testnet testing!');
    console.log('');
    console.log('Frontend integration:');
    console.log(`ORACLE_RESOLVER_ADDRESS=${oracleResolverAddress.toString()}`);
    console.log(`MARKET_FACTORY_ADDRESS=${marketFactoryAddress.toString()}`);
}
