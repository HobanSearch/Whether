/**
 * Whether Oracle Bot - Configuration
 */

import * as dotenv from 'dotenv';
import { BotConfig, ConsensusTolerance } from './types';

dotenv.config();

export function loadConfig(): BotConfig {
    const config: BotConfig = {
        tonEndpoint: process.env.TON_ENDPOINT || 'https://testnet.toncenter.com/api/v2/jsonRPC',
        tonApiKey: process.env.TON_API_KEY || '',
        oracleContract: process.env.ORACLE_CONTRACT || '',
        walletMnemonic: process.env.WALLET_MNEMONIC || '',
        checkwxApiKey: process.env.CHECKWX_API_KEY,
        openweatherApiKey: process.env.OPENWEATHER_API_KEY,
        submitIntervalMs: parseInt(process.env.SUBMIT_INTERVAL_MS || '900000', 10),
        locations: (process.env.LOCATIONS || 'NYC,LON,TKY').split(',').map(s => s.trim()),
        logLevel: process.env.LOG_LEVEL || 'info',
    };

    // Validate required config
    if (!config.oracleContract) {
        console.warn('Warning: ORACLE_CONTRACT not set');
    }
    if (!config.walletMnemonic) {
        console.warn('Warning: WALLET_MNEMONIC not set');
    }

    return config;
}

// Consensus tolerances (matching contract constants)
export const CONSENSUS_TOLERANCES: ConsensusTolerance = {
    temperature: 10,      // ±1.0°C in int16 format (×10)
    precipitation: 50,    // ±5.0mm in uint16 format (×10)
    visibility: 500,      // ±500m
    windSpeed: 50,        // ±5 knots in uint16 format (×10)
    pressure: 5,          // ±5 hPa
    humidity: 10,         // ±10%
};

// Minimum sources required for consensus
export const MIN_SOURCES = 2;

// Source priorities (lower = higher priority)
export const SOURCE_PRIORITIES = {
    NWS: 1,           // Official US government
    CHECKWX: 2,       // Aviation METAR
    OPENWEATHER: 3,   // Commercial API
    OPENMETEO: 4,     // Free backup
};
