#!/usr/bin/env node
/**
 * Whether Oracle Bot - CLI Entry Point
 * Fetches weather data and submits to OracleResolver contract
 */

import { config } from 'dotenv';
import { OracleBot } from './bot';
import { loadConfig } from './config';
import { BotConfig } from './types';
import { ALL_LOCATIONS, getLocation } from './locations';

// Load environment variables
config();

interface CliArgs {
    once: boolean;
    locations: string[];
    help: boolean;
    listLocations: boolean;
    verbose: boolean;
}

function parseArgs(): CliArgs {
    const args = process.argv.slice(2);
    const result: CliArgs = {
        once: false,
        locations: [],
        help: false,
        listLocations: false,
        verbose: false,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--once' || arg === '-1') {
            result.once = true;
        } else if (arg === '--help' || arg === '-h') {
            result.help = true;
        } else if (arg === '--list' || arg === '-l') {
            result.listLocations = true;
        } else if (arg === '--verbose' || arg === '-v') {
            result.verbose = true;
        } else if (arg === '--locations' || arg === '-L') {
            const nextArg = args[++i];
            if (nextArg) {
                result.locations = nextArg.split(',').map(s => s.trim().toUpperCase());
            }
        } else if (arg.startsWith('--locations=')) {
            result.locations = arg.split('=')[1].split(',').map(s => s.trim().toUpperCase());
        }
    }

    return result;
}

function printHelp(): void {
    console.log(`
Whether Oracle Bot - Weather Data Oracle for TON Blockchain

USAGE:
    npx ts-node src/index.ts [OPTIONS]
    npm start -- [OPTIONS]

OPTIONS:
    -h, --help              Show this help message
    -l, --list              List all supported locations
    -1, --once              Run once and exit (no loop)
    -L, --locations <LIST>  Comma-separated location codes to process
                            Example: --locations NYC,LON,TKY
    -v, --verbose           Enable verbose logging

ENVIRONMENT VARIABLES:
    TON_ENDPOINT            TON API endpoint (default: testnet)
    TON_API_KEY             TonCenter API key (optional)
    ORACLE_CONTRACT         OracleResolver contract address (required)
    WALLET_MNEMONIC         24-word wallet mnemonic (required)
    CHECKWX_API_KEY         CheckWX API key (for METAR data)
    OPENWEATHER_API_KEY     OpenWeatherMap API key
    SUBMIT_INTERVAL_MS      Submission interval in ms (default: 900000)
    LOCATIONS               Default locations to process

EXAMPLES:
    # Run continuously for configured locations
    npm start

    # Run once for specific locations
    npm start -- --once --locations NYC,LON,TKY

    # List all supported locations
    npm start -- --list

For more information, see the README.md file.
`);
}

function printLocations(): void {
    console.log('\nSupported Locations:\n');
    console.log('AIRPORTS (ICAO codes):');
    console.log('─'.repeat(60));

    const airports = ALL_LOCATIONS.filter(loc => loc.type === 'airport');
    for (const loc of airports) {
        console.log(`  ${loc.code.padEnd(6)} ${loc.name.padEnd(30)} ID: ${loc.id}`);
    }

    console.log('\nCITIES:');
    console.log('─'.repeat(60));

    const cities = ALL_LOCATIONS.filter(loc => loc.type === 'city');
    for (const loc of cities) {
        console.log(`  ${loc.code.padEnd(6)} ${loc.name.padEnd(30)} ID: ${loc.id}`);
    }

    console.log(`\nTotal: ${ALL_LOCATIONS.length} locations`);
}

function validateLocations(codes: string[]): string[] {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const code of codes) {
        const location = getLocation(code);
        if (location) {
            valid.push(code);
        } else {
            invalid.push(code);
        }
    }

    if (invalid.length > 0) {
        console.warn(`[CLI] Warning: Unknown locations ignored: ${invalid.join(', ')}`);
    }

    return valid;
}

async function main(): Promise<void> {
    console.log('═'.repeat(50));
    console.log('     Whether Oracle Bot v1.0.0');
    console.log('     Weather Data Oracle for TON Blockchain');
    console.log('═'.repeat(50));
    console.log('');

    const args = parseArgs();

    if (args.help) {
        printHelp();
        process.exit(0);
    }

    if (args.listLocations) {
        printLocations();
        process.exit(0);
    }

    // Load configuration
    let botConfig: BotConfig;
    try {
        botConfig = loadConfig();
    } catch (error) {
        console.error('[CLI] Configuration error:', error instanceof Error ? error.message : error);
        console.log('[CLI] Run with --help for usage information');
        process.exit(1);
    }

    // Override locations from CLI if provided
    if (args.locations.length > 0) {
        const validLocations = validateLocations(args.locations);
        if (validLocations.length === 0) {
            console.error('[CLI] No valid locations specified');
            process.exit(1);
        }
        botConfig.locations = validLocations;
    }

    // Validate we have locations
    if (botConfig.locations.length === 0) {
        console.error('[CLI] No locations configured');
        console.log('[CLI] Set LOCATIONS env var or use --locations flag');
        process.exit(1);
    }

    // Validate required config
    if (!botConfig.oracleContract) {
        console.error('[CLI] ORACLE_CONTRACT not set');
        process.exit(1);
    }

    if (!botConfig.walletMnemonic) {
        console.error('[CLI] WALLET_MNEMONIC not set');
        process.exit(1);
    }

    // Create bot
    const bot = new OracleBot(botConfig);

    // Handle shutdown
    const shutdown = () => {
        console.log('\n[CLI] Shutdown signal received...');
        bot.stop();
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Run bot
    try {
        if (args.once) {
            await bot.runOnce();
        } else {
            await bot.start();
        }
    } catch (error) {
        console.error('[CLI] Fatal error:', error);
        process.exit(1);
    }

    console.log('[CLI] Bot stopped');
    process.exit(0);
}

// Run main
main().catch(error => {
    console.error('[CLI] Unhandled error:', error);
    process.exit(1);
});
