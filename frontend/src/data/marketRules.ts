/**
 * Whether Market Rules Data
 *
 * Comprehensive rule definitions for all product lines, resolution types,
 * and settlement procedures. Similar to Polymarket/Kalshi rule definitions.
 */

import { ProductLine, ResolutionType, MarketType } from '../types';

// ============================================
// RESOLUTION SOURCE DEFINITIONS
// ============================================

export interface ResolutionSource {
    name: string;
    description: string;
    url: string;
    updateFrequency: string;
    dataFormat: string;
}

export const RESOLUTION_SOURCES: Record<string, ResolutionSource> = {
    NWS_METAR: {
        name: 'National Weather Service METAR',
        description: 'Official aviation weather reports from airports worldwide',
        url: 'https://aviationweather.gov/metar',
        updateFrequency: 'Every 30-60 minutes',
        dataFormat: 'METAR coded weather observations',
    },
    NWS_DAILY_CLIMATE: {
        name: 'NWS Daily Climate Reports',
        description: 'Official daily climate summaries including high/low temperatures and precipitation',
        url: 'https://www.weather.gov/wrh/climate',
        updateFrequency: 'Daily at 00:00 UTC',
        dataFormat: 'Daily climate summary',
    },
    ECMWF_ERA5: {
        name: 'ECMWF ERA5 Reanalysis',
        description: 'Global atmospheric reanalysis data used for historical verification',
        url: 'https://cds.climate.copernicus.eu',
        updateFrequency: 'Daily (5-day delay)',
        dataFormat: 'Gridded reanalysis data',
    },
    OPEN_METEO: {
        name: 'Open-Meteo Weather API',
        description: 'Open-source weather API aggregating multiple weather model outputs',
        url: 'https://open-meteo.com',
        updateFrequency: 'Hourly',
        dataFormat: 'JSON weather data',
    },
};

// ============================================
// ORACLE CONFIGURATION
// ============================================

export interface OracleConfig {
    name: string;
    description: string;
    consensusMethod: string;
    reporterCount: number;
    disputeWindow: number; // hours
    settlementDelay: number; // hours
}

export const ORACLE_CONFIG: OracleConfig = {
    name: 'Whether Oracle Network',
    description: 'Multi-reporter oracle system with on-chain verification',
    consensusMethod: 'Median of reporter submissions',
    reporterCount: 3,
    disputeWindow: 1, // 1 hour dispute window
    settlementDelay: 24, // 24 hours after market expiry
};

// ============================================
// RESOLUTION TYPE RULES
// ============================================

export interface ResolutionTypeRule {
    type: ResolutionType;
    name: string;
    description: string;
    unit: string;
    displayUnit: string;
    conversionFactor: number;
    source: string;
    measurementMethod: string;
    examples: string[];
}

export const RESOLUTION_TYPE_RULES: Record<ResolutionType, ResolutionTypeRule> = {
    temp_high: {
        type: 'temp_high',
        name: 'Daily High Temperature',
        description: 'The maximum temperature recorded during the 24-hour observation period (00:00-23:59 UTC)',
        unit: 'tenths of degrees Celsius',
        displayUnit: '°C',
        conversionFactor: 10,
        source: 'NWS_DAILY_CLIMATE',
        measurementMethod: 'Highest temperature reading from official weather station during the observation period',
        examples: [
            'temp_high > 300 = Daily high exceeds 30°C',
            'temp_high > 250 = Daily high exceeds 25°C',
            'temp_high < 0 = Daily high below 0°C (freezing)',
        ],
    },
    temp_low: {
        type: 'temp_low',
        name: 'Daily Low Temperature',
        description: 'The minimum temperature recorded during the 24-hour observation period (00:00-23:59 UTC)',
        unit: 'tenths of degrees Celsius',
        displayUnit: '°C',
        conversionFactor: 10,
        source: 'NWS_DAILY_CLIMATE',
        measurementMethod: 'Lowest temperature reading from official weather station during the observation period',
        examples: [
            'temp_low < 0 = Daily low below 0°C (freezing)',
            'temp_low < -100 = Daily low below -10°C',
            'temp_low > 200 = Daily low above 20°C (warm night)',
        ],
    },
    precipitation: {
        type: 'precipitation',
        name: 'Daily Precipitation',
        description: 'Total liquid precipitation (rain, melted snow) measured during the 24-hour observation period',
        unit: 'tenths of millimeters',
        displayUnit: 'mm',
        conversionFactor: 10,
        source: 'NWS_DAILY_CLIMATE',
        measurementMethod: 'Total precipitation collected in rain gauge, snow melted before measurement',
        examples: [
            'precipitation > 0 = Any measurable precipitation (>0.1mm)',
            'precipitation > 100 = More than 10mm of precipitation',
            'precipitation > 250 = More than 25mm (heavy rain)',
        ],
    },
    visibility: {
        type: 'visibility',
        name: 'Visibility',
        description: 'Horizontal visibility as reported in METAR observations',
        unit: 'meters',
        displayUnit: 'km',
        conversionFactor: 1000,
        source: 'NWS_METAR',
        measurementMethod: 'Prevailing visibility reported by airport weather observation system',
        examples: [
            'visibility > 5000 = Visibility above 5km (good)',
            'visibility > 1000 = Visibility above 1km (moderate)',
            'visibility < 400 = Visibility below 400m (poor/fog)',
        ],
    },
    wind_speed: {
        type: 'wind_speed',
        name: 'Wind Speed',
        description: 'Sustained wind speed as reported in METAR observations',
        unit: 'tenths of knots',
        displayUnit: 'knots',
        conversionFactor: 10,
        source: 'NWS_METAR',
        measurementMethod: '2-minute average wind speed at standard 10-meter height',
        examples: [
            'wind_speed > 200 = Wind speed above 20 knots',
            'wind_speed > 350 = Wind speed above 35 knots (gale)',
            'wind_speed > 480 = Wind speed above 48 knots (storm)',
        ],
    },
    conditions: {
        type: 'conditions',
        name: 'Weather Conditions',
        description: 'Categorical weather conditions encoded as integers',
        unit: 'enum',
        displayUnit: '',
        conversionFactor: 1,
        source: 'NWS_METAR',
        measurementMethod: 'Weather phenomena reported in METAR observation',
        examples: [
            'conditions == 0 = Clear/Few clouds',
            'conditions == 1 = Cloudy/Overcast',
            'conditions == 2 = Rain',
            'conditions == 3 = Snow',
            'conditions == 4 = Thunderstorm/Severe',
        ],
    },
};

// ============================================
// PRODUCT LINE RULES
// ============================================

export interface ProductLineRule {
    productLine: ProductLine;
    name: string;
    description: string;
    icon: string;
    color: string;
    primaryUseCase: string;
    typicalMarkets: string[];
    resolutionTypes: ResolutionType[];
    settlementNotes: string[];
    riskFactors: string[];
}

export const PRODUCT_LINE_RULES: Record<ProductLine, ProductLineRule> = {
    airport: {
        productLine: 'airport',
        name: 'Flight Watch',
        description: 'Markets focused on airport weather conditions affecting flight operations',
        icon: 'wind',
        color: '#3B82F6',
        primaryUseCase: 'Predict visibility and wind conditions at major airports',
        typicalMarkets: [
            'Visibility above/below threshold',
            'Wind speed exceeding operational limits',
            'Fog or low visibility events',
        ],
        resolutionTypes: ['visibility', 'wind_speed', 'conditions'],
        settlementNotes: [
            'Uses METAR observations from airport weather stations',
            'Settled using the minimum visibility during the observation period',
            'Wind speed uses maximum sustained winds reported',
        ],
        riskFactors: [
            'METAR reporting delays may occur',
            'Multiple observations throughout the day are considered',
            'Automated weather stations may have brief outages',
        ],
    },
    urban: {
        productLine: 'urban',
        name: 'City Heat',
        description: 'Markets focused on city temperature extremes and urban heat effects',
        icon: 'sun',
        color: '#F59E0B',
        primaryUseCase: 'Predict daily high and low temperatures in major cities',
        typicalMarkets: [
            'Daily high temperature above threshold',
            'Daily low temperature below threshold',
            'Heat wave conditions',
        ],
        resolutionTypes: ['temp_high', 'temp_low'],
        settlementNotes: [
            'Uses official daily climate reports from NWS',
            'Temperature measured at standard meteorological stations',
            'Observation period is 00:00-23:59 UTC',
        ],
        riskFactors: [
            'Urban heat island effect may cause higher readings',
            'Station location affects measurements',
            'Preliminary data may be revised',
        ],
    },
    precipitation: {
        productLine: 'precipitation',
        name: 'Rain Check',
        description: 'Markets focused on rainfall and precipitation events',
        icon: 'rain',
        color: '#06B6D4',
        primaryUseCase: 'Predict whether rain will occur and precipitation amounts',
        typicalMarkets: [
            'Any measurable precipitation (yes/no)',
            'Precipitation above threshold',
            'Drought/dry spell predictions',
        ],
        resolutionTypes: ['precipitation'],
        settlementNotes: [
            'Uses official daily precipitation totals',
            'Snow is melted and measured as liquid equivalent',
            'Trace amounts (<0.1mm) count as zero',
        ],
        riskFactors: [
            'Localized storms may miss measurement stations',
            'Snow measurement can vary by technique',
            'Rain gauge errors possible during heavy events',
        ],
    },
    extreme: {
        productLine: 'extreme',
        name: 'Storm Chasers',
        description: 'Markets focused on severe weather events and extreme conditions',
        icon: 'storm',
        color: '#8B5CF6',
        primaryUseCase: 'Predict occurrence of severe weather events',
        typicalMarkets: [
            'Thunderstorm occurrence',
            'Severe weather warnings issued',
            'Extreme wind events',
        ],
        resolutionTypes: ['conditions', 'wind_speed', 'precipitation'],
        settlementNotes: [
            'Severe weather defined by NWS warning criteria',
            'Multiple data sources may be consulted',
            'Events must be officially reported',
        ],
        riskFactors: [
            'Severe weather is inherently unpredictable',
            'Warning criteria may vary by region',
            'Localized events may not be captured',
        ],
    },
    energy: {
        productLine: 'energy',
        name: 'Power Grid',
        description: 'Markets focused on temperature conditions affecting energy demand',
        icon: 'lightning',
        color: '#EF4444',
        primaryUseCase: 'Predict temperatures that drive heating/cooling demand',
        typicalMarkets: [
            'Temperature triggering high AC demand',
            'Temperature triggering heating demand',
            'Extreme temperature events',
        ],
        resolutionTypes: ['temp_high', 'temp_low'],
        settlementNotes: [
            'Temperature thresholds based on typical demand curves',
            'Uses same data sources as Urban markets',
            'Regional demand patterns considered',
        ],
        riskFactors: [
            'Energy demand depends on many factors beyond temperature',
            'Grid conditions not directly measured',
            'Industrial demand variations',
        ],
    },
    agricultural: {
        productLine: 'agricultural',
        name: 'Harvest Outlook',
        description: 'Markets focused on weather conditions affecting agriculture',
        icon: 'leaf',
        color: '#10B981',
        primaryUseCase: 'Predict precipitation and temperature for crop conditions',
        typicalMarkets: [
            'Adequate rainfall for crops',
            'Frost/freeze events',
            'Drought conditions',
        ],
        resolutionTypes: ['precipitation', 'temp_high', 'temp_low'],
        settlementNotes: [
            'Agricultural regions may use regional averages',
            'Growing degree days may be calculated',
            'Drought indices may be referenced',
        ],
        riskFactors: [
            'Agriculture depends on extended weather patterns',
            'Regional variations significant',
            'Soil moisture not directly measured',
        ],
    },
};

// ============================================
// MARKET TYPE RULES
// ============================================

export interface MarketTypeRule {
    type: MarketType;
    name: string;
    description: string;
    howItWorks: string[];
    settlementProcess: string[];
    examples: string[];
}

export const MARKET_TYPE_RULES: Record<MarketType, MarketTypeRule> = {
    binary: {
        type: 'binary',
        name: 'Binary (Yes/No)',
        description: 'Markets with two possible outcomes: YES or NO',
        howItWorks: [
            'Buy YES if you think the condition will be met',
            'Buy NO if you think the condition will NOT be met',
            'Prices range from 0% to 100%, reflecting probability',
            'If correct, receive 1 TON per share; if wrong, receive 0',
        ],
        settlementProcess: [
            'At market expiry, trading stops',
            'Oracle submits observed weather data',
            'Data compared against resolution criteria',
            'Winning side receives full payout (1 TON per share)',
        ],
        examples: [
            'Will NYC high temp exceed 30°C? → YES if observed high > 30°C',
            'Will it rain in London? → YES if precipitation > 0mm',
        ],
    },
    bracket: {
        type: 'bracket',
        name: 'Bracket (Range)',
        description: 'Markets with multiple outcome ranges',
        howItWorks: [
            'Choose which bracket the observed value will fall into',
            'Multiple brackets cover the entire possible range',
            'Each bracket has independent pricing',
            'Only one bracket can win',
        ],
        settlementProcess: [
            'At market expiry, trading stops',
            'Oracle submits exact observed value',
            'Value mapped to winning bracket',
            'All shares in winning bracket receive payout',
        ],
        examples: [
            'Tokyo temperature brackets: <15°C, 15-20°C, 20-25°C, >25°C',
            'Precipitation amounts: 0mm, 0-5mm, 5-15mm, >15mm',
        ],
    },
    scalar: {
        type: 'scalar',
        name: 'Scalar (Range Trade)',
        description: 'Markets that pay out proportionally based on where the value lands in a range',
        howItWorks: [
            'Long position profits if value is higher',
            'Short position profits if value is lower',
            'Payout proportional to position in range',
            'Range has defined min and max values',
        ],
        settlementProcess: [
            'At market expiry, trading stops',
            'Oracle submits observed value',
            'Payout calculated based on position in range',
            'Linear interpolation between min and max',
        ],
        examples: [
            'Temperature range 20-30°C: Long wins more as temp increases',
            'Precipitation 0-50mm: Short wins if less rain falls',
        ],
    },
};

// ============================================
// SETTLEMENT TIMELINE
// ============================================

export interface SettlementPhase {
    name: string;
    duration: string;
    description: string;
    userAction?: string;
}

export const SETTLEMENT_TIMELINE: SettlementPhase[] = [
    {
        name: 'Trading Active',
        duration: 'Until market expiry',
        description: 'Users can buy and sell positions',
        userAction: 'Trade based on your weather predictions',
    },
    {
        name: 'Trading Closed',
        duration: 'At market expiry',
        description: 'No more trading allowed; positions locked',
        userAction: 'Wait for settlement',
    },
    {
        name: 'Data Collection',
        duration: '0-24 hours after expiry',
        description: 'Oracle collects official weather data',
        userAction: 'Wait for data finalization',
    },
    {
        name: 'Data Submission',
        duration: 'After data finalized',
        description: 'Oracle reporters submit observed values',
        userAction: 'Wait for consensus',
    },
    {
        name: 'Dispute Window',
        duration: '1 hour',
        description: 'Period to challenge incorrect data',
        userAction: 'Review settlement if you believe it is incorrect',
    },
    {
        name: 'Settlement',
        duration: 'After dispute window',
        description: 'Winning outcome determined, payouts available',
        userAction: 'Claim your winnings',
    },
];

// ============================================
// PLATFORM RULES
// ============================================

export interface PlatformRule {
    category: string;
    title: string;
    content: string;
}

export const PLATFORM_RULES: PlatformRule[] = [
    {
        category: 'General',
        title: 'Eligibility',
        content: 'Whether markets are open to all users with a TON wallet. Users must comply with applicable laws in their jurisdiction.',
    },
    {
        category: 'General',
        title: 'Market Resolution',
        content: 'All markets are resolved using official weather data from recognized meteorological sources. The Whether Oracle Network provides consensus-based settlement.',
    },
    {
        category: 'Trading',
        title: 'Minimum Trade',
        content: 'Minimum trade size is 0.1 TON. There is no maximum trade size, but large trades may experience price impact.',
    },
    {
        category: 'Trading',
        title: 'Trading Hours',
        content: 'Markets are open 24/7 until their expiry time. After expiry, no new trades are accepted.',
    },
    {
        category: 'Trading',
        title: 'Price Impact',
        content: 'Whether uses an Automated Market Maker (AMM). Large trades will move the price. Slippage protection is available.',
    },
    {
        category: 'Settlement',
        title: 'Settlement Timing',
        content: 'Markets settle 24 hours after expiry to allow for official weather data finalization. A 1-hour dispute window follows data submission.',
    },
    {
        category: 'Settlement',
        title: 'Disputes',
        content: 'Users can dispute settlements within the dispute window by providing evidence of incorrect data. Disputes require a bond.',
    },
    {
        category: 'Settlement',
        title: 'Claiming Winnings',
        content: 'After settlement, users must claim their winnings. Unclaimed winnings remain available indefinitely.',
    },
    {
        category: 'Fees',
        title: 'Trading Fees',
        content: 'A 1% fee is charged on all trades. Fees are used for liquidity provision and platform operation.',
    },
    {
        category: 'Fees',
        title: 'Withdrawal Fees',
        content: 'Network gas fees apply to all TON transactions. There are no additional platform withdrawal fees.',
    },
    {
        category: 'Data',
        title: 'Data Sources',
        content: 'Weather data is sourced from NWS METAR, NWS Daily Climate Reports, ECMWF, and Open-Meteo. Multiple sources ensure reliability.',
    },
    {
        category: 'Data',
        title: 'Data Delays',
        content: 'Official weather data may be delayed by up to 24 hours. Preliminary data is not used for settlement.',
    },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getResolutionTypeRule(type: ResolutionType): ResolutionTypeRule {
    return RESOLUTION_TYPE_RULES[type];
}

export function getProductLineRule(productLine: ProductLine): ProductLineRule {
    return PRODUCT_LINE_RULES[productLine];
}

export function getMarketTypeRule(type: MarketType): MarketTypeRule {
    return MARKET_TYPE_RULES[type];
}

export function formatResolutionValue(type: ResolutionType, value: number): string {
    const rule = RESOLUTION_TYPE_RULES[type];
    if (type === 'conditions') {
        const conditions = ['Clear', 'Cloudy', 'Rain', 'Snow', 'Storm'];
        return conditions[value] || 'Unknown';
    }
    const displayValue = value / rule.conversionFactor;
    return `${displayValue.toFixed(1)}${rule.displayUnit}`;
}

export function parseResolutionCriteria(criteria: string): {
    type: ResolutionType;
    operator: string;
    threshold: number;
    thresholdFormatted: string;
} | null {
    const match = criteria.match(/^(\w+)\s*(>|<|>=|<=|==)\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) return null;

    const [, typeStr, operator, thresholdStr] = match;
    const type = typeStr as ResolutionType;
    const threshold = parseFloat(thresholdStr);

    if (!RESOLUTION_TYPE_RULES[type]) return null;

    return {
        type,
        operator,
        threshold,
        thresholdFormatted: formatResolutionValue(type, threshold),
    };
}

export function getRulesByCategory(category: string): PlatformRule[] {
    return PLATFORM_RULES.filter(rule => rule.category === category);
}

export function getAllCategories(): string[] {
    return [...new Set(PLATFORM_RULES.map(rule => rule.category))];
}
