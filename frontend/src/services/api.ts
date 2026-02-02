import axios from 'axios';
import type {
    Market,
    MarketPrices,
    Position,
    TradeParams,
    TradeResult,
    InsurancePolicy,
    InsuranceQuote,
    CapitalPool,
    PurchasePolicyParams,
    Forecast,
    Location,
    WeatherData,
    User,
    UserStats,
    Squad,
    Region,
    PrepareBetRequest,
    PrepareBetResponse,
    PrepareClaimRequest,
    PrepareClaimResponse,
    TradeEstimate,
    MarketOdds,
    UserMarketPosition,
    SettlementStatus,
    Achievement,
    AchievementStats,
    PointsInfo,
    PointsHistoryEntry,
    StreakInfo,
    DailyLoginResult,
    EngagementSummary,
    LeaderboardEntry,
    Agent,
    AgentStatus,
    AgentPosition,
    AgentPrediction,
    AgentLeaderboardEntry,
    AgentRank,
    StrategyConfig,
    PoolStatsResponse,
    LPPositionResponse,
    PrepareDepositResponse,
    PrepareWithdrawResponse,
    LPTransactionResponse,
    APYHistoryResponse,
    DepositEstimateResponse,
    WithdrawEstimateResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

export interface MarketFilters {
    location?: string;
    marketType?: string;
    productLine?: string;
    status?: string;
    limit?: number;
    offset?: number;
}

export const api = {
    // Markets
    async getMarkets(filters?: MarketFilters): Promise<Market[]> {
        const params: Record<string, string | number> = {};
        if (filters?.location) params.location = filters.location;
        if (filters?.marketType) params.market_type = filters.marketType;
        if (filters?.productLine) params.product_line = filters.productLine;
        if (filters?.status) params.status = filters.status;
        if (filters?.limit) params.limit = filters.limit;
        if (filters?.offset) params.offset = filters.offset;

        const { data } = await client.get('/api/markets', { params });
        const markets = Array.isArray(data) ? data : data.markets;
        return markets.map((m: any) => this._parseMarket(m));
    },

    async getMarketsByLocation(locationCode: string, status?: string): Promise<Market[]> {
        const params: Record<string, string> = {};
        if (status) params.status = status;
        const { data } = await client.get(`/api/markets/by-location/${locationCode}`, { params });
        return (data.markets || []).map((m: any) => this._parseMarket(m));
    },

    async getMarket(marketId: string): Promise<Market> {
        const { data } = await client.get(`/api/markets/${marketId}`);
        return this._parseMarket(data);
    },

    async getMarketPrices(marketId: string): Promise<MarketPrices> {
        const { data } = await client.get(`/api/markets/${marketId}/prices`);
        return data;
    },

    async getPositions(walletAddress: string): Promise<Position[]> {
        const { data } = await client.get(`/api/positions/${walletAddress}`);
        return data.positions;
    },

    async executeTrade(params: TradeParams): Promise<TradeResult> {
        const { data } = await client.post('/api/trades', {
            market_id: params.marketId,
            side: params.side,
            amount: params.amount.toString(),
            min_output: params.minOutput.toString(),
        });
        return {
            success: data.success,
            amountIn: BigInt(data.amount_in),
            amountOut: BigInt(data.amount_out),
            newYesPrice: data.new_yes_price,
            newNoPrice: data.new_no_price,
            txHash: data.tx_hash,
        };
    },

    async mintTokens(marketId: string, amount: bigint): Promise<TradeResult> {
        const { data } = await client.post(`/api/markets/${marketId}/mint`, {
            amount: amount.toString(),
        });
        return {
            success: data.success,
            amountIn: BigInt(data.amount_in),
            amountOut: BigInt(data.amount_out),
            newYesPrice: data.new_yes_price,
            newNoPrice: data.new_no_price,
            txHash: data.tx_hash,
        };
    },

    async redeemTokens(marketId: string, amount: bigint): Promise<TradeResult> {
        const { data } = await client.post(`/api/markets/${marketId}/redeem`, {
            amount: amount.toString(),
        });
        return {
            success: data.success,
            amountIn: BigInt(data.amount_in),
            amountOut: BigInt(data.amount_out),
            newYesPrice: data.new_yes_price,
            newNoPrice: data.new_no_price,
            txHash: data.tx_hash,
        };
    },

    async claimPayout(marketId: string, tokenType: 'YES' | 'NO'): Promise<{ success: boolean; amount: bigint }> {
        const { data } = await client.post(`/api/markets/${marketId}/claim`, {
            token_type: tokenType,
        });
        return {
            success: data.success,
            amount: BigInt(data.amount),
        };
    },

    // Trading - TON Connect Flow
    async prepareBet(
        marketId: string,
        params: PrepareBetRequest
    ): Promise<PrepareBetResponse> {
        const { data } = await client.post(`/api/markets/${marketId}/prepare-bet`, {
            side: params.side,
            amount: params.amount,
            slippage: params.slippage ?? 0.5,
            bracket_index: params.bracketIndex,
        });
        return {
            transaction: {
                to: data.transaction.to,
                value: data.transaction.value,
                payload: data.transaction.payload,
                stateInit: data.transaction.state_init,
            },
            estimate: {
                inputAmount: data.estimate.input_amount,
                outputTokens: data.estimate.output_tokens,
                minOutput: data.estimate.min_output,
                priceImpact: data.estimate.price_impact,
                effectivePrice: data.estimate.effective_price,
                yesPriceAfter: data.estimate.yes_price_after,
                noPriceAfter: data.estimate.no_price_after,
            },
        };
    },

    async prepareClaim(
        marketId: string,
        params: PrepareClaimRequest
    ): Promise<PrepareClaimResponse> {
        const { data } = await client.post(`/api/markets/${marketId}/prepare-claim`, {
            user_address: params.userAddress,
        });
        return {
            transaction: data.transaction ? {
                to: data.transaction.to,
                value: data.transaction.value,
                payload: data.transaction.payload,
                stateInit: data.transaction.state_init,
            } : undefined,
            estimate: {
                claimable: data.estimate.claimable,
                payoutAmount: data.estimate.payout_amount,
                winningSide: data.estimate.winning_side,
                reason: data.estimate.reason,
            },
        };
    },

    async prepareRefund(
        marketId: string,
        userAddress: string
    ): Promise<{ transaction?: { to: string; value: string; payload: string }; refundAmount: string }> {
        const { data } = await client.post(`/api/markets/${marketId}/prepare-refund`, {
            user_address: userAddress,
        });
        return {
            transaction: data.transaction ? {
                to: data.transaction.to,
                value: data.transaction.value,
                payload: data.transaction.payload,
            } : undefined,
            refundAmount: data.refund_amount,
        };
    },

    async getTradeEstimate(
        marketId: string,
        side: 'YES' | 'NO',
        amount: string,
        bracketIndex?: number
    ): Promise<TradeEstimate> {
        const params: Record<string, string | number> = { side, amount };
        if (bracketIndex !== undefined) {
            params.bracket_index = bracketIndex;
        }
        const { data } = await client.get(`/api/markets/${marketId}/estimate`, {
            params,
        });
        return {
            inputAmount: data.input_amount,
            outputTokens: data.output_tokens,
            minOutput: data.min_output,
            priceImpact: data.price_impact,
            effectivePrice: data.effective_price,
            yesPriceAfter: data.yes_price_after,
            noPriceAfter: data.no_price_after,
        };
    },

    async getMarketOdds(marketId: string): Promise<MarketOdds> {
        const { data } = await client.get(`/api/markets/${marketId}/odds`);
        return {
            yesPct: data.yes_pct,
            noPct: data.no_pct,
            lastUpdated: data.last_updated,
        };
    },

    async getUserPosition(
        marketId: string,
        userAddress: string
    ): Promise<UserMarketPosition | null> {
        const { data } = await client.get(`/api/markets/${marketId}/positions/${userAddress}`);
        if (!data || !data.market_id) {
            return null;
        }
        return {
            marketId: data.market_id,
            market: data.market,
            yesBalance: data.yes_balance,
            noBalance: data.no_balance,
            avgYesPrice: data.avg_yes_price,
            avgNoPrice: data.avg_no_price,
            unrealizedPnl: data.unrealized_pnl,
        };
    },

    async getSettlementStatus(marketId: string): Promise<SettlementStatus> {
        const { data } = await client.get(`/api/markets/${marketId}/settlement`);
        return {
            marketAddress: data.market_address,
            status: data.status,
            expiryTimestamp: data.expiry_timestamp,
            weatherFinalized: data.weather_finalized,
            weatherData: data.weather_data ? {
                temperature: data.weather_data.temperature,
                temperatureMax: data.weather_data.temperature_max,
                temperatureMin: data.weather_data.temperature_min,
                precipitation: data.weather_data.precipitation,
                visibility: data.weather_data.visibility,
                windSpeed: data.weather_data.wind_speed,
                conditions: data.weather_data.conditions,
                timestamp: data.weather_data.timestamp,
                isFinalized: data.weather_data.is_finalized,
            } : undefined,
            disputeWindowEnds: data.dispute_window_ends,
            canClaim: data.can_claim,
            outcome: data.outcome,
            settlementValue: data.settlement_value,
            nextAction: data.next_action,
        };
    },

    async refreshMarket(marketId: string): Promise<Market> {
        const { data } = await client.post(`/api/markets/${marketId}/refresh`);
        return data;
    },

    async submitDispute(
        marketId: string,
        userAddress: string,
        reason: string,
        evidence: string
    ): Promise<{ success: boolean; disputeId: string; message: string }> {
        const { data } = await client.post(`/api/markets/${marketId}/dispute`, {
            user_address: userAddress,
            reason,
            evidence,
        });
        return {
            success: data.success,
            disputeId: data.dispute_id,
            message: data.message,
        };
    },

    // Insurance
    async getInsurancePolicies(walletAddress: string): Promise<InsurancePolicy[]> {
        const { data } = await client.get(`/api/insurance/policies/${walletAddress}`);
        return data.policies;
    },

    async getInsuranceQuote(
        coverageAmount: bigint,
        duration: number,
        location: string,
        threshold: number,
        comparison: 'above' | 'below'
    ): Promise<InsuranceQuote> {
        const { data } = await client.get('/api/insurance/quote', {
            params: {
                coverage_amount: coverageAmount.toString(),
                duration,
                location,
                threshold,
                comparison,
            },
        });
        return {
            premium: BigInt(data.premium),
            baseRate: data.base_rate,
            basisRiskAdjustment: data.basis_risk_adjustment,
            loadFactor: data.load_factor,
            effectivePremiumRate: data.effective_premium_rate,
        };
    },

    async getCapitalPool(): Promise<CapitalPool> {
        const { data } = await client.get('/api/insurance/capital');
        return {
            totalCapital: BigInt(data.total_capital),
            lockedCapital: BigInt(data.locked_capital),
            availableCapital: BigInt(data.available_capital),
            utilizationRate: data.utilization_rate,
        };
    },

    async purchasePolicy(params: PurchasePolicyParams): Promise<{ success: boolean; policyId: string }> {
        const { data } = await client.post('/api/insurance/purchase', {
            product_type: params.productType,
            location: params.location,
            threshold: params.threshold,
            comparison: params.comparison,
            coverage_amount: params.coverageAmount.toString(),
            start_time: params.startTime,
            end_time: params.endTime,
        });
        return {
            success: data.success,
            policyId: data.policy_id,
        };
    },

    async claimInsurance(policyId: string): Promise<{ success: boolean; amount: bigint }> {
        const { data } = await client.post(`/api/insurance/claim/${policyId}`);
        return {
            success: data.success,
            amount: BigInt(data.amount),
        };
    },

    async addCapital(amount: bigint): Promise<{ success: boolean; newTotal: bigint }> {
        const { data } = await client.post('/api/insurance/capital', {
            amount: amount.toString(),
        });
        return {
            success: data.success,
            newTotal: BigInt(data.new_total),
        };
    },

    // Forecasts
    async getForecast(location: string, date?: string): Promise<Forecast> {
        const { data } = await client.get('/api/forecasts', {
            params: { location, date },
        });
        return {
            location: data.location,
            locationId: data.location_id || 0,
            date: data.date,
            pointForecast: {
                tMax: data.point_forecast.t_max,
                tMin: data.point_forecast.t_min,
            },
            distribution: {
                p10: data.distribution.p10,
                p25: data.distribution.p25,
                p50: data.distribution.p50,
                p75: data.distribution.p75,
                p90: data.distribution.p90,
            },
            confidence: {
                ci68: data.confidence.ci_68,
                ci95: data.confidence.ci_95,
            },
            generatedAt: data.generated_at,
        };
    },

    // Locations
    async getLocations(params?: { type?: string; region?: string }): Promise<Location[]> {
        const { data } = await client.get('/api/weather/locations', { params });
        return data.locations.map((loc: any) => ({
            id: loc.id,
            code: loc.code,
            name: loc.name,
            type: loc.type,
            coordinates: { lat: loc.lat, lon: loc.lon },
            timezone: loc.timezone,
            country: loc.country,
            region: loc.region as Region,
            isActive: true,
        }));
    },

    async getLocation(locationId: number): Promise<Location> {
        const { data } = await client.get(`/api/weather/locations/${locationId}`);
        return {
            id: data.id,
            code: data.code,
            name: data.name,
            type: data.type,
            coordinates: { lat: data.lat, lon: data.lon },
            timezone: data.timezone,
            country: data.country,
            region: data.region as Region,
            isActive: true,
        };
    },

    async getAirports(): Promise<Location[]> {
        const { data } = await client.get('/api/weather/locations/airports');
        return data.locations.map((loc: any) => ({
            id: loc.id,
            code: loc.code,
            name: loc.name,
            type: loc.type,
            coordinates: { lat: loc.lat, lon: loc.lon },
            timezone: loc.timezone,
            country: loc.country,
            region: loc.region as Region,
            icao: loc.code,
            isActive: true,
        }));
    },

    async getCities(): Promise<Location[]> {
        const { data } = await client.get('/api/weather/locations/cities');
        return data.locations.map((loc: any) => ({
            id: loc.id,
            code: loc.code,
            name: loc.name,
            type: loc.type,
            coordinates: { lat: loc.lat, lon: loc.lon },
            timezone: loc.timezone,
            country: loc.country,
            region: loc.region as Region,
            isActive: true,
        }));
    },

    async getRegions(): Promise<string[]> {
        const { data } = await client.get('/api/weather/locations/regions');
        return data;
    },

    // Weather
    async getWeather(locationId: number, date?: string): Promise<WeatherData> {
        const { data } = await client.get(`/api/weather/${locationId}`, {
            params: date ? { date } : undefined,
        });
        return {
            locationId: data.location_id,
            observationDate: data.observation_date,
            temperature: data.temperature,
            temperatureMax: data.temperature_max,
            temperatureMin: data.temperature_min,
            precipitation: data.precipitation || 0,
            visibility: data.visibility || 0,
            windSpeed: data.wind_speed || 0,
            windDirection: data.wind_direction || 0,
            windGust: data.wind_gust,
            pressure: data.pressure || 0,
            humidity: data.humidity || 0,
            conditions: data.conditions || 'clear',
            isFinalized: true,
        };
    },

    async getWeatherByCode(code: string, date?: string): Promise<WeatherData> {
        const { data } = await client.get(`/api/weather/code/${code}`, {
            params: date ? { date } : undefined,
        });
        return {
            locationId: data.location_id,
            observationDate: data.observation_date,
            temperature: data.temperature,
            temperatureMax: data.temperature_max,
            temperatureMin: data.temperature_min,
            precipitation: data.precipitation || 0,
            visibility: data.visibility || 0,
            windSpeed: data.wind_speed || 0,
            windDirection: data.wind_direction || 0,
            windGust: data.wind_gust,
            pressure: data.pressure || 0,
            humidity: data.humidity || 0,
            conditions: data.conditions || 'clear',
            isFinalized: true,
        };
    },

    // Users
    async getOrCreateUser(telegramId: number, tonAddress?: string, username?: string): Promise<User> {
        const { data } = await client.post('/api/users/', {
            telegram_id: telegramId,
            ton_address: tonAddress,
            username,
        });
        return this._parseUser(data);
    },

    async getCurrentUser(telegramId: number): Promise<User> {
        const { data } = await client.get('/api/users/me', {
            params: { telegram_id: telegramId },
        });
        return this._parseUser(data);
    },

    async getUser(userId: string): Promise<User> {
        const { data } = await client.get(`/api/users/${userId}`);
        return this._parseUser(data);
    },

    async getUserStats(userId: string): Promise<UserStats> {
        const { data } = await client.get(`/api/users/${userId}/stats`);
        return {
            totalBets: data.total_bets,
            totalWins: data.total_wins,
            totalVolume: BigInt(data.total_volume),
            accuracyScore: data.accuracy_score,
            winRate: data.win_rate,
        };
    },

    async applyReferral(userId: string, referralCode: string): Promise<{ success: boolean; message: string }> {
        const { data } = await client.post(`/api/users/${userId}/referral`, {
            referral_code: referralCode,
        });
        return data;
    },

    async joinSquad(userId: string, squadId: string): Promise<{ success: boolean; message: string }> {
        const { data } = await client.post(`/api/users/${userId}/squad/${squadId}/join`);
        return data;
    },

    async leaveSquad(userId: string): Promise<{ success: boolean; message: string }> {
        const { data } = await client.post(`/api/users/${userId}/squad/leave`);
        return data;
    },

    async getUserLeaderboard(metric: string = 'volume', limit: number = 100): Promise<any> {
        const { data } = await client.get('/api/users/leaderboard/', {
            params: { metric, limit },
        });
        return data;
    },

    _parseUser(data: any): User {
        return {
            id: data.id,
            telegramId: data.telegram_id,
            tonAddress: data.ton_address,
            username: data.username,
            firstName: data.first_name,
            lastName: data.last_name,
            languageCode: data.language_code,
            tier: data.tier,
            stats: {
                totalBets: data.stats.total_bets,
                totalWins: data.stats.total_wins,
                totalVolume: BigInt(data.stats.total_volume),
                accuracyScore: data.stats.accuracy_score,
                winRate: data.stats.win_rate,
            },
            squadId: data.squad?.id,
            squad: data.squad ? this._parseSquad(data.squad) : undefined,
            referralCode: data.referral_code,
            referralEarnings: BigInt(0),
            createdAt: data.created_at,
            lastActiveAt: data.last_active_at,
        };
    },

    // Squads
    async getSquads(params?: { region?: string; limit?: number }): Promise<Squad[]> {
        const { data } = await client.get('/api/squads/', { params });
        return data.squads.map((s: any) => this._parseSquad(s));
    },

    async getSquad(squadId: string): Promise<Squad & { topMembers: any[] }> {
        const { data } = await client.get(`/api/squads/${squadId}`);
        return {
            ...this._parseSquad(data),
            topMembers: data.top_members,
        };
    },

    async getSquadByCode(code: string): Promise<Squad> {
        const { data } = await client.get(`/api/squads/code/${code}`);
        return this._parseSquad(data);
    },

    async searchSquads(query: string, limit: number = 10): Promise<Squad[]> {
        const { data } = await client.get('/api/squads/search', {
            params: { q: query, limit },
        });
        return data.squads.map((s: any) => this._parseSquad(s));
    },

    async getSquadLeaderboard(period: string = 'weekly', limit: number = 50): Promise<any> {
        const { data } = await client.get('/api/squads/leaderboard', {
            params: { period, limit },
        });
        return data;
    },

    async getSquadRegions(): Promise<string[]> {
        const { data } = await client.get('/api/squads/regions');
        return data;
    },

    async createSquad(name: string, code: string, region?: string): Promise<{ success: boolean; message: string; squad?: Squad }> {
        const { data } = await client.post('/api/squads/', { name, code, region });
        return {
            success: data.success,
            message: data.message,
            squad: data.squad ? this._parseSquad(data.squad) : undefined,
        };
    },

    _parseSquad(data: any): Squad {
        return {
            id: data.id,
            name: data.name,
            code: data.code,
            region: data.region as Region,
            memberCount: data.member_count,
            totalVolume: BigInt(data.total_volume),
            totalWins: data.total_wins,
            totalAccuracy: data.total_accuracy,
            weeklyRank: data.weekly_rank,
            allTimeRank: data.all_time_rank,
        };
    },

    // ============================================
    // ACHIEVEMENTS
    // ============================================

    async getAchievements(userId?: string, unlockedOnly: boolean = false): Promise<Achievement[]> {
        const params: Record<string, any> = {};
        if (userId) params.user_id = userId;
        if (unlockedOnly) params.unlocked_only = unlockedOnly;

        const { data } = await client.get('/api/achievements/', { params });
        return data.achievements.map((a: any) => this._parseAchievement(a));
    },

    async getAchievementStats(userId: string): Promise<AchievementStats> {
        const { data } = await client.get(`/api/achievements/stats/${userId}`);
        return {
            totalAchievements: data.total_achievements,
            unlockedCount: data.unlocked_count,
            completionPct: data.completion_pct,
            pointsEarned: data.points_earned,
            rarityBreakdown: data.rarity_breakdown,
        };
    },

    async getRecentAchievements(userId: string, limit: number = 10): Promise<Achievement[]> {
        const { data } = await client.get(`/api/achievements/recent/${userId}`, {
            params: { limit },
        });
        return data.unlocks.map((a: any) => this._parseAchievement(a));
    },

    async initializeAchievements(): Promise<{ success: boolean; achievementsCreated: number }> {
        const { data } = await client.post('/api/achievements/initialize');
        return {
            success: data.success,
            achievementsCreated: data.achievements_created,
        };
    },

    _parseAchievement(data: any): Achievement {
        return {
            id: data.id,
            name: data.name,
            description: data.description,
            icon: data.icon,
            category: data.category,
            rarity: data.rarity,
            pointsReward: data.points_reward,
            badgeColor: data.badge_color,
            isUnlocked: data.is_unlocked || false,
            unlockedAt: data.unlocked_at,
            progress: data.progress || 0,
            target: data.target || 0,
            progressPct: data.progress_pct || 0,
        };
    },

    // ============================================
    // POINTS
    // ============================================

    async getPointsInfo(userId: string): Promise<PointsInfo> {
        const { data } = await client.get(`/api/points/${userId}`);
        return {
            balance: data.balance,
            totalEarned: data.total_earned,
            totalSpent: data.total_spent,
            earnedBreakdown: {
                bets: data.earned_breakdown.bets,
                wins: data.earned_breakdown.wins,
                streaks: data.earned_breakdown.streaks,
                referrals: data.earned_breakdown.referrals,
                achievements: data.earned_breakdown.achievements,
                daily: data.earned_breakdown.daily,
            },
            loginStreak: data.login_streak,
            bestLoginStreak: data.best_login_streak,
            dailyLoginAvailable: data.daily_login_available,
            tierMultiplier: data.tier_multiplier,
        };
    },

    async getPointsHistory(userId: string, limit: number = 50, offset: number = 0): Promise<PointsHistoryEntry[]> {
        const { data } = await client.get(`/api/points/${userId}/history`, {
            params: { limit, offset },
        });
        return data.entries.map((e: any) => ({
            id: e.id,
            amount: e.amount,
            source: e.source,
            description: e.description,
            balanceAfter: e.balance_after,
            streakMultiplier: e.streak_multiplier,
            tierMultiplier: e.tier_multiplier,
            createdAt: e.created_at,
        }));
    },

    async claimDailyLogin(userId: string): Promise<DailyLoginResult> {
        const { data } = await client.post(`/api/points/${userId}/daily-login`);
        return {
            success: data.success,
            baseAmount: data.base_amount,
            streakBonus: data.streak_bonus,
            totalAwarded: data.total_awarded,
            loginStreak: data.login_streak,
            bestLoginStreak: data.best_login_streak,
            newBalance: data.new_balance,
            error: data.error,
            nextAvailableAt: data.next_available_at,
        };
    },

    async getEngagementSummary(userId: string): Promise<EngagementSummary> {
        const { data } = await client.get(`/api/points/${userId}/summary`);
        return {
            streak: {
                currentStreak: data.streak.current_streak,
                bestStreak: data.streak.best_streak,
                multiplier: data.streak.multiplier,
                nextMilestone: data.streak.next_milestone,
                nextMilestoneMultiplier: data.streak.next_milestone_multiplier,
                isActive: data.streak.is_active,
                lastWinAt: data.streak.last_win_at,
                streakUpdatedAt: data.streak.streak_updated_at,
            },
            points: {
                balance: data.points.balance,
                totalEarned: data.points.total_earned,
                totalSpent: data.points.total_spent,
                earnedBreakdown: {
                    bets: data.points.earned_breakdown.bets,
                    wins: data.points.earned_breakdown.wins,
                    streaks: data.points.earned_breakdown.streaks,
                    referrals: data.points.earned_breakdown.referrals,
                    achievements: data.points.earned_breakdown.achievements,
                    daily: data.points.earned_breakdown.daily,
                },
                loginStreak: data.points.login_streak,
                bestLoginStreak: data.points.best_login_streak,
                dailyLoginAvailable: data.points.daily_login_available,
                tierMultiplier: data.points.tier_multiplier,
            },
            achievements: {
                stats: {
                    totalAchievements: data.achievements.stats.total_achievements,
                    unlockedCount: data.achievements.stats.unlocked_count,
                    completionPct: data.achievements.stats.completion_pct,
                    pointsEarned: data.achievements.stats.points_earned,
                    rarityBreakdown: data.achievements.stats.rarity_breakdown,
                },
                recent: data.achievements.recent.map((a: any) => this._parseAchievement(a)),
            },
        };
    },

    // ============================================
    // STREAKS
    // ============================================

    async getStreakInfo(userId: string): Promise<StreakInfo> {
        const { data } = await client.get(`/api/leaderboards/streaks/${userId}`);
        return {
            currentStreak: data.current_streak,
            bestStreak: data.best_streak,
            multiplier: data.multiplier,
            nextMilestone: data.next_milestone,
            nextMilestoneMultiplier: data.next_milestone_multiplier,
            isActive: data.is_active,
            lastWinAt: data.last_win_at,
            streakUpdatedAt: data.streak_updated_at,
        };
    },

    // ============================================
    // LEADERBOARDS
    // ============================================

    async getStreakLeaderboard(limit: number = 100): Promise<LeaderboardEntry[]> {
        const { data } = await client.get('/api/leaderboards/streaks/current', { params: { limit } });
        return data.entries.map((e: any) => ({
            rank: e.rank,
            userId: e.user_id,
            displayName: e.first_name || e.username || 'Anonymous',
            avatarUrl: e.avatar_url,
            value: e.current_streak,
        }));
    },

    async getPointsLeaderboard(limit: number = 100, timeFrame: string = 'all'): Promise<LeaderboardEntry[]> {
        const { data } = await client.get('/api/leaderboards/points', {
            params: { metric: 'balance', limit, time_frame: timeFrame },
        });
        return data.entries.map((e: any) => ({
            rank: e.rank,
            userId: e.user_id,
            displayName: e.first_name || e.username || 'Anonymous',
            avatarUrl: e.avatar_url,
            value: e.balance,
        }));
    },

    // ============================================
    // AGENTS
    // ============================================

    async getAgents(userId?: string, status?: AgentStatus, limit: number = 100, offset: number = 0): Promise<Agent[]> {
        const params: Record<string, any> = { limit, offset };
        if (userId) params.userId = userId;
        if (status) params.status = status;

        const { data } = await client.get('/api/agents', { params });
        return data.agents.map((a: any) => this._parseAgent(a));
    },

    async getAgent(agentId: string): Promise<Agent> {
        const { data } = await client.get(`/api/agents/${agentId}`);
        return this._parseAgent(data);
    },

    async createAgent(
        telegramChatId: number,
        strategyName: string,
        strategyConfig: StrategyConfig
    ): Promise<Agent> {
        const { data } = await client.post('/api/agents', {
            telegram_chat_id: telegramChatId,
            strategy_name: strategyName,
            strategy_config: {
                thesis: strategyConfig.thesis,
                market_selection: {
                    types: strategyConfig.marketSelection.types,
                    locations: strategyConfig.marketSelection.locations,
                    time_horizon: strategyConfig.marketSelection.timeHorizon,
                },
                entry_conditions: strategyConfig.entryConditions.map(c => ({
                    field: c.field,
                    operator: c.operator,
                    value: c.value,
                })),
                position_direction: strategyConfig.positionDirection,
                position_sizing: {
                    base_size: strategyConfig.positionSizing.baseSize,
                    scaling_rule: strategyConfig.positionSizing.scalingRule,
                    max_position: strategyConfig.positionSizing.maxPosition,
                },
                risk_controls: {
                    min_confidence: strategyConfig.riskControls.minConfidence,
                    min_edge: strategyConfig.riskControls.minEdge,
                    max_daily_loss: strategyConfig.riskControls.maxDailyLoss,
                    max_positions: strategyConfig.riskControls.maxPositions,
                },
            },
        });
        return this._parseAgent(data);
    },

    async updateAgent(
        agentId: string,
        updates: { status?: AgentStatus; strategyConfig?: StrategyConfig }
    ): Promise<Agent> {
        const payload: Record<string, any> = {};
        if (updates.status) payload.status = updates.status;
        if (updates.strategyConfig) {
            payload.strategy_config = {
                thesis: updates.strategyConfig.thesis,
                market_selection: {
                    types: updates.strategyConfig.marketSelection.types,
                    locations: updates.strategyConfig.marketSelection.locations,
                    time_horizon: updates.strategyConfig.marketSelection.timeHorizon,
                },
                entry_conditions: updates.strategyConfig.entryConditions.map(c => ({
                    field: c.field,
                    operator: c.operator,
                    value: c.value,
                })),
                position_direction: updates.strategyConfig.positionDirection,
                position_sizing: {
                    base_size: updates.strategyConfig.positionSizing.baseSize,
                    scaling_rule: updates.strategyConfig.positionSizing.scalingRule,
                    max_position: updates.strategyConfig.positionSizing.maxPosition,
                },
                risk_controls: {
                    min_confidence: updates.strategyConfig.riskControls.minConfidence,
                    min_edge: updates.strategyConfig.riskControls.minEdge,
                    max_daily_loss: updates.strategyConfig.riskControls.maxDailyLoss,
                    max_positions: updates.strategyConfig.riskControls.maxPositions,
                },
            };
        }

        const { data } = await client.patch(`/api/agents/${agentId}`, payload);
        return this._parseAgent(data);
    },

    async getAgentPositions(
        agentId: string,
        status?: string,
        limit: number = 100,
        offset: number = 0
    ): Promise<AgentPosition[]> {
        const params: Record<string, any> = { limit, offset };
        if (status) params.status = status;

        const { data } = await client.get(`/api/agents/${agentId}/positions`, { params });
        return data.positions.map((p: any) => this._parseAgentPosition(p));
    },

    async createAgentPosition(
        agentId: string,
        marketId: string,
        direction: 'YES' | 'NO',
        amount: string
    ): Promise<AgentPosition> {
        const { data } = await client.post(`/api/agents/${agentId}/positions`, {
            market_id: marketId,
            direction,
            amount,
        });
        return this._parseAgentPosition(data);
    },

    async getAgentPredictions(
        agentId: string,
        limit: number = 50,
        offset: number = 0
    ): Promise<AgentPrediction[]> {
        const { data } = await client.get(`/api/agents/${agentId}/predictions`, {
            params: { limit, offset },
        });
        return data.predictions.map((p: any) => this._parseAgentPrediction(p));
    },

    async getAgentLeaderboard(period: string = 'all_time', limit: number = 100): Promise<AgentLeaderboardEntry[]> {
        const { data } = await client.get('/api/agents/leaderboard', {
            params: { period, limit },
        });
        return data.entries.map((e: any) => ({
            rank: e.rank,
            agentId: e.agent_id,
            agentName: e.agent_name,
            strategyName: e.strategy_name,
            ownerUsername: e.owner_username,
            score: e.score,
            winRate: e.win_rate,
            totalPnl: e.total_pnl,
            totalTrades: e.total_trades,
            predictionAccuracy: e.prediction_accuracy,
        }));
    },

    async getAgentRank(agentId: string, period: string = 'all_time'): Promise<AgentRank> {
        const { data } = await client.get(`/api/agents/${agentId}/rank`, {
            params: { period },
        });
        return {
            agentId: data.agent_id,
            rank: data.rank,
            totalAgents: data.total_agents,
            percentile: data.percentile,
            score: data.score,
            period: data.period,
        };
    },

    _parseAgent(data: any): Agent {
        return {
            id: data.id,
            userId: data.user_id,
            telegramChatId: data.telegram_chat_id,
            strategyName: data.strategy_name,
            strategyConfig: this._parseStrategyConfig(data.strategy_config),
            status: data.status as AgentStatus,
            totalTrades: data.total_trades,
            winningTrades: data.winning_trades,
            losingTrades: data.losing_trades,
            winRate: data.win_rate,
            totalPnl: data.total_pnl,
            predictionAccuracy: data.prediction_accuracy,
            avgConfidence: data.avg_confidence,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        };
    },

    _parseStrategyConfig(data: any): StrategyConfig {
        return {
            strategyName: data.strategy_name || '',
            thesis: data.thesis,
            marketSelection: {
                types: data.market_selection?.types || [],
                locations: data.market_selection?.locations || [],
                timeHorizon: data.market_selection?.time_horizon || [],
            },
            entryConditions: (data.entry_conditions || []).map((c: any) => ({
                field: c.field,
                operator: c.operator,
                value: c.value,
            })),
            positionDirection: data.position_direction || 'dynamic',
            positionSizing: {
                baseSize: data.position_sizing?.base_size || 0.05,
                scalingRule: data.position_sizing?.scaling_rule || 'fixed',
                maxPosition: data.position_sizing?.max_position,
            },
            riskControls: {
                minConfidence: data.risk_controls?.min_confidence || 'medium',
                minEdge: data.risk_controls?.min_edge || 0.05,
                maxPositionSize: data.risk_controls?.max_position_size || 0.5,
                maxDailyTrades: data.risk_controls?.max_daily_trades || 10,
                maxDailyLoss: data.risk_controls?.max_daily_loss,
                maxPositions: data.risk_controls?.max_positions,
            },
        };
    },

    _parseAgentPosition(data: any): AgentPosition {
        return {
            id: data.id,
            agentId: data.agent_id,
            marketId: data.market_id,
            marketQuestion: data.market_question,
            direction: data.direction,
            amount: data.amount,
            entryPrice: data.entry_price,
            exitPrice: data.exit_price,
            pnl: data.pnl,
            status: data.status,
            predictionId: data.prediction_id,
            createdAt: data.created_at,
            closedAt: data.closed_at,
        };
    },

    _parseAgentPrediction(data: any): AgentPrediction {
        return {
            id: data.id,
            agentId: data.agent_id,
            marketId: data.market_id,
            marketQuestion: data.market_question,
            marketProbability: data.market_probability,
            predictedProbability: data.predicted_probability,
            confidence: data.confidence,
            edge: data.edge,
            reasoning: data.reasoning,
            weatherFactors: data.weather_factors || [],
            recommendedDirection: data.recommended_direction,
            recommendedSize: data.recommended_size,
            wasCorrect: data.was_correct,
            createdAt: data.created_at,
        };
    },

    _parseMarket(data: any): Market {
        return {
            id: data.id,
            marketId: data.market_id || parseInt(data.id) || 0,
            address: data.address,
            title: data.question || data.title || '',
            question: data.question || '',
            description: data.description,
            locationId: data.location_id,
            location: data.location,
            marketType: data.market_type || 'binary',
            productLine: data.product_line,
            resolutionType: data.resolution_type || 'temp_high',
            threshold: data.threshold || 0,
            comparisonType: data.comparison_type || 'gt',
            settlementTime: data.settlement_time,
            bettingEndsAt: data.betting_ends_at || data.settlement_time,
            status: data.status || 'active',
            outcome: data.outcome,
            winningBracket: data.winning_bracket,
            observedValue: data.observed_value,
            yesPrice: data.yes_price ?? 0.5,
            noPrice: data.no_price ?? 0.5,
            yesPool: BigInt(data.yes_pool || data.yes_supply || '0'),
            noPool: BigInt(data.no_pool || data.no_supply || '0'),
            totalCollateral: BigInt(data.total_collateral || '0'),
            totalVolume: BigInt(data.total_volume || data.total_collateral || '0'),
            uniqueBettors: data.unique_bettors || 0,
            yesSupply: BigInt(data.yes_supply || '0'),
            noSupply: BigInt(data.no_supply || '0'),
            createdAt: data.created_at || 0,
            settledAt: data.settled_at,
            seriesId: data.series_id,
            seriesIndex: data.series_index,
            brackets: data.brackets?.map((b: any) => ({
                id: b.id,
                marketId: b.market_id,
                index: b.index,
                lowerBound: b.lower_bound,
                upperBound: b.upper_bound,
                label: b.label,
                totalStaked: BigInt(b.total_staked || '0'),
            })),
        };
    },

    // ============================================
    // LIQUIDITY POOL
    // ============================================

    async getPoolStats(): Promise<PoolStatsResponse> {
        const { data } = await client.get('/api/liquidity/pool-stats');
        return data;
    },

    async getLPPosition(walletAddress: string): Promise<LPPositionResponse> {
        const { data } = await client.get(`/api/liquidity/position/${walletAddress}`);
        return data;
    },

    async prepareDeposit(walletAddress: string, amount: string): Promise<PrepareDepositResponse> {
        const { data } = await client.post('/api/liquidity/prepare-deposit', {
            wallet_address: walletAddress,
            amount,
        });
        return {
            transaction: {
                to: data.transaction.to,
                value: data.transaction.value,
                payload: data.transaction.payload,
                state_init: data.transaction.state_init,
            },
            estimate: {
                input_amount: data.estimate.input_amount,
                shares_to_receive: data.estimate.shares_to_receive,
                share_price: data.estimate.share_price,
                share_of_pool_after: data.estimate.share_of_pool_after,
            },
        };
    },

    async prepareWithdraw(walletAddress: string, shares: string): Promise<PrepareWithdrawResponse> {
        const { data } = await client.post('/api/liquidity/prepare-withdraw', {
            wallet_address: walletAddress,
            shares,
        });
        return {
            transaction: {
                to: data.transaction.to,
                value: data.transaction.value,
                payload: data.transaction.payload,
                state_init: data.transaction.state_init,
            },
            estimate: {
                shares_to_burn: data.estimate.shares_to_burn,
                amount_to_receive: data.estimate.amount_to_receive,
                fee: data.estimate.fee,
                net_amount: data.estimate.net_amount,
                share_price: data.estimate.share_price,
            },
        };
    },

    async getLPTransactions(
        walletAddress: string,
        limit: number = 50,
        offset: number = 0
    ): Promise<LPTransactionResponse[]> {
        const { data } = await client.get(`/api/liquidity/transactions/${walletAddress}`, {
            params: { limit, offset },
        });
        return data;
    },

    async getAPYHistory(days: number = 30): Promise<APYHistoryResponse> {
        const { data } = await client.get('/api/liquidity/apy-history', {
            params: { days },
        });
        return data;
    },

    async getDepositEstimate(amount: string): Promise<DepositEstimateResponse> {
        const { data } = await client.get('/api/liquidity/estimate-deposit', {
            params: { amount },
        });
        return data;
    },

    async getWithdrawEstimate(shares: string): Promise<WithdrawEstimateResponse> {
        const { data } = await client.get('/api/liquidity/estimate-withdraw', {
            params: { shares },
        });
        return data;
    },
};
