export {
    useMarkets,
    useMarketsByLocation,
    useMarket,
    useMarketPrices,
    usePositions,
    useTrade,
    useMintTokens,
    useRedeemTokens,
    useClaimPayout,
    useSubmitDispute,
} from './useMarkets';

export {
    useInsurancePolicies,
    useInsuranceQuote,
    useCapitalPool,
    usePurchasePolicy,
    useClaimInsurance,
    useAddCapital,
} from './useInsurance';

export { useTelegramApp } from './useTelegramApp';

export {
    useLocations,
    useLocation,
    useAirports,
    useCities,
    useRegions,
} from './useLocations';

export {
    useWeather,
    useWeatherByCode,
    useCurrentWeather,
    useMultipleWeather,
} from './useWeather';

export {
    useForecast,
    useForecastRange,
    useMultiLocationForecast,
} from './useForecast';

export {
    useUser,
    useCurrentUser,
    useUserStats,
    useUserLeaderboard,
    useCreateOrUpdateUser,
    useApplyReferral,
    useJoinSquad,
    useLeaveSquad,
} from './useUser';

export { useTelegramAuth } from '../providers/TelegramAuthProvider';

export {
    useSquads,
    useSquad,
    useSquadByCode,
    useSearchSquads,
    useSquadLeaderboard,
    useSquadRegions,
    useCreateSquad,
} from './useSquad';

export {
    useAgents,
    useAgent,
    useCreateAgent,
    useUpdateAgent,
    useAgentPositions,
    useCreateAgentPosition,
    useAgentPredictions,
    useAgentLeaderboard,
    useAgentRank,
    usePauseAgent,
    useResumeAgent,
    useStopAgent,
} from './useAgents';

export { useGeolocation } from './useGeolocation';
