"""Whether Prediction Market API client."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any

import httpx
import structlog

logger = structlog.get_logger()


class MarketStatus(str, Enum):
    """Market status states."""

    PENDING = "pending"
    ACTIVE = "active"
    PAUSED = "paused"
    RESOLVING = "resolving"
    RESOLVED = "resolved"
    CANCELLED = "cancelled"


class MarketType(str, Enum):
    """Market types."""

    TEMPERATURE_HIGH = "temperature_high"
    TEMPERATURE_LOW = "temperature_low"
    PRECIPITATION = "precipitation"
    SNOW = "snow"


class Location(str, Enum):
    """Supported locations."""

    NYC = "NYC"
    CHI = "CHI"
    MIA = "MIA"
    AUS = "AUS"


@dataclass
class Market:
    """Weather prediction market."""

    id: str
    type: MarketType
    location: Location
    question: str
    description: str
    yes_price: Decimal
    no_price: Decimal
    yes_pool: Decimal
    no_pool: Decimal
    status: MarketStatus
    resolution_time: datetime
    created_at: datetime
    threshold: float | None = None
    actual_value: float | None = None
    outcome: str | None = None
    metadata: dict[str, Any] | None = None

    @property
    def yes_probability(self) -> float:
        """Get YES probability from price."""
        return float(self.yes_price) * 100

    @property
    def no_probability(self) -> float:
        """Get NO probability from price."""
        return float(self.no_price) * 100

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Market:
        """Create from API response dict."""
        return cls(
            id=data["id"],
            type=MarketType(data["type"]),
            location=Location(data["location"]),
            question=data["question"],
            description=data.get("description", ""),
            yes_price=Decimal(str(data["yesPrice"])),
            no_price=Decimal(str(data["noPrice"])),
            yes_pool=Decimal(str(data.get("yesPool", 0))),
            no_pool=Decimal(str(data.get("noPool", 0))),
            status=MarketStatus(data["status"]),
            resolution_time=datetime.fromisoformat(data["resolutionTime"].replace("Z", "+00:00")),
            created_at=datetime.fromisoformat(data["createdAt"].replace("Z", "+00:00")),
            threshold=data.get("threshold"),
            actual_value=data.get("actualValue"),
            outcome=data.get("outcome"),
            metadata=data.get("metadata"),
        )


@dataclass
class TradeEstimate:
    """Trade estimate from AMM."""

    input_amount: Decimal
    output_amount: Decimal
    price_impact: Decimal
    average_price: Decimal
    new_yes_price: Decimal
    new_no_price: Decimal

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TradeEstimate:
        """Create from API response dict."""
        return cls(
            input_amount=Decimal(str(data["inputAmount"])),
            output_amount=Decimal(str(data["outputAmount"])),
            price_impact=Decimal(str(data["priceImpact"])),
            average_price=Decimal(str(data["averagePrice"])),
            new_yes_price=Decimal(str(data["newYesPrice"])),
            new_no_price=Decimal(str(data["newNoPrice"])),
        )


@dataclass
class PaperPosition:
    """Paper trading position."""

    id: str
    agent_id: str
    market_id: str
    direction: str
    amount: Decimal
    entry_price: Decimal
    status: str
    created_at: datetime
    exit_price: Decimal | None = None
    pnl: Decimal | None = None
    closed_at: datetime | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PaperPosition:
        """Create from API response dict."""
        closed_at = None
        if data.get("closedAt"):
            closed_at = datetime.fromisoformat(data["closedAt"].replace("Z", "+00:00"))

        return cls(
            id=data["id"],
            agent_id=data["agentId"],
            market_id=data["marketId"],
            direction=data["direction"],
            amount=Decimal(str(data["amount"])),
            entry_price=Decimal(str(data["entryPrice"])),
            status=data["status"],
            created_at=datetime.fromisoformat(data["createdAt"].replace("Z", "+00:00")),
            exit_price=Decimal(str(data["exitPrice"])) if data.get("exitPrice") else None,
            pnl=Decimal(str(data["pnl"])) if data.get("pnl") else None,
            closed_at=closed_at,
        )


@dataclass
class AgentStats:
    """Agent statistics from leaderboard."""

    agent_id: str
    strategy_name: str
    total_trades: int
    winning_trades: int
    total_pnl: Decimal
    win_rate: float
    rank: int
    score: Decimal

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AgentStats:
        """Create from API response dict."""
        return cls(
            agent_id=data["agentId"],
            strategy_name=data["strategyName"],
            total_trades=data["totalTrades"],
            winning_trades=data["winningTrades"],
            total_pnl=Decimal(str(data["totalPnl"])),
            win_rate=data["winRate"],
            rank=data["rank"],
            score=Decimal(str(data["score"])),
        )


class WhetherAPIClient:
    """Client for Whether Prediction Market API."""

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        timeout: float = 30.0,
    ) -> None:
        """Initialize API client.

        Args:
            base_url: API base URL (defaults to env var WHETHER_API_URL)
            api_key: API key for authentication (defaults to env var WHETHER_API_KEY)
            timeout: Request timeout in seconds
        """
        self.base_url = (base_url or os.environ.get("WHETHER_API_URL", "http://localhost:8000")).rstrip("/")
        self.api_key = api_key or os.environ.get("WHETHER_API_KEY", "")

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        self._client = httpx.Client(
            base_url=self.base_url,
            headers=headers,
            timeout=timeout,
        )

        logger.info("whether_api_client_initialized", base_url=self.base_url)

    def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        """Make GET request."""
        response = self._client.get(path, params=params)
        response.raise_for_status()
        return response.json()

    def _post(self, path: str, data: dict[str, Any] | None = None) -> Any:
        """Make POST request."""
        response = self._client.post(path, json=data or {})
        response.raise_for_status()
        return response.json()

    def _patch(self, path: str, data: dict[str, Any] | None = None) -> Any:
        """Make PATCH request."""
        response = self._client.patch(path, json=data or {})
        response.raise_for_status()
        return response.json()

    # =========================================================================
    # MARKET OPERATIONS
    # =========================================================================

    def get_markets(
        self,
        location: str | None = None,
        market_type: str | None = None,
        status: str | None = None,
    ) -> list[Market]:
        """Get list of markets with optional filters.

        Args:
            location: Filter by location code
            market_type: Filter by market type
            status: Filter by status

        Returns:
            List of markets
        """
        params: dict[str, str] = {}
        if location:
            params["location"] = location
        if market_type:
            params["type"] = market_type
        if status:
            params["status"] = status

        data = self._get("/api/markets", params=params)
        markets = data if isinstance(data, list) else data.get("markets", [])

        logger.info("markets_fetched", count=len(markets), filters=params)
        return [Market.from_dict(m) for m in markets]

    def get_market(self, market_id: str) -> Market:
        """Get market by ID.

        Args:
            market_id: Market identifier

        Returns:
            Market details
        """
        data = self._get(f"/api/markets/{market_id}")
        return Market.from_dict(data)

    def get_active_markets(self) -> list[Market]:
        """Get all active markets."""
        return self.get_markets(status=MarketStatus.ACTIVE.value)

    def estimate_trade(
        self,
        market_id: str,
        direction: str,
        amount: Decimal,
    ) -> TradeEstimate:
        """Estimate trade output.

        Args:
            market_id: Market to trade on
            direction: "YES" or "NO"
            amount: Amount to trade

        Returns:
            Trade estimate
        """
        data = self._post(
            f"/api/markets/{market_id}/estimate",
            {"direction": direction, "amount": str(amount)},
        )
        return TradeEstimate.from_dict(data)

    # =========================================================================
    # AGENT OPERATIONS
    # =========================================================================

    def create_agent(
        self,
        user_id: str,
        telegram_chat_id: int,
        strategy_name: str,
        strategy_config: dict[str, Any],
    ) -> dict[str, Any]:
        """Create a new agent.

        Args:
            user_id: User identifier
            telegram_chat_id: Telegram chat ID for notifications
            strategy_name: Name of the strategy
            strategy_config: Strategy configuration

        Returns:
            Created agent data
        """
        data = self._post(
            "/api/agents",
            {
                "userId": user_id,
                "telegramChatId": telegram_chat_id,
                "strategyName": strategy_name,
                "strategyConfig": strategy_config,
            },
        )
        logger.info("agent_created", agent_id=data.get("id"))
        return data

    def get_agent(self, agent_id: str) -> dict[str, Any]:
        """Get agent by ID."""
        return self._get(f"/api/agents/{agent_id}")

    def get_user_agents(self, user_id: str) -> list[dict[str, Any]]:
        """Get all agents for a user."""
        data = self._get("/api/agents", params={"userId": user_id})
        return data if isinstance(data, list) else data.get("agents", [])

    def update_agent_status(self, agent_id: str, status: str) -> dict[str, Any]:
        """Update agent status.

        Args:
            agent_id: Agent identifier
            status: New status (active, paused, stopped)

        Returns:
            Updated agent data
        """
        data = self._patch(f"/api/agents/{agent_id}", {"status": status})
        logger.info("agent_status_updated", agent_id=agent_id, status=status)
        return data

    # =========================================================================
    # POSITION OPERATIONS
    # =========================================================================

    def create_paper_position(
        self,
        agent_id: str,
        market_id: str,
        direction: str,
        amount: Decimal,
    ) -> PaperPosition:
        """Create a paper trading position.

        Args:
            agent_id: Agent creating the position
            market_id: Market to trade on
            direction: "YES" or "NO"
            amount: Position size

        Returns:
            Created position
        """
        data = self._post(
            f"/api/agents/{agent_id}/positions",
            {
                "marketId": market_id,
                "direction": direction,
                "amount": str(amount),
            },
        )
        logger.info(
            "paper_position_created",
            agent_id=agent_id,
            market_id=market_id,
            direction=direction,
            amount=str(amount),
        )
        return PaperPosition.from_dict(data)

    def get_agent_positions(
        self,
        agent_id: str,
        status: str | None = None,
    ) -> list[PaperPosition]:
        """Get positions for an agent.

        Args:
            agent_id: Agent identifier
            status: Filter by status

        Returns:
            List of positions
        """
        params = {}
        if status:
            params["status"] = status

        data = self._get(f"/api/agents/{agent_id}/positions", params=params)
        positions = data if isinstance(data, list) else data.get("positions", [])
        return [PaperPosition.from_dict(p) for p in positions]

    # =========================================================================
    # LEADERBOARD OPERATIONS
    # =========================================================================

    def get_leaderboard(
        self,
        period: str = "all_time",
        limit: int = 100,
    ) -> list[AgentStats]:
        """Get agent leaderboard.

        Args:
            period: Time period (all_time, weekly, daily)
            limit: Maximum entries to return

        Returns:
            List of agent stats
        """
        data = self._get(
            "/api/agents/leaderboard",
            params={"period": period, "limit": limit},
        )
        entries = data if isinstance(data, list) else data.get("leaderboard", [])
        return [AgentStats.from_dict(e) for e in entries]

    def get_agent_rank(self, agent_id: str) -> AgentStats | None:
        """Get agent's rank and stats.

        Args:
            agent_id: Agent identifier

        Returns:
            Agent stats or None if not ranked
        """
        try:
            data = self._get(f"/api/agents/{agent_id}/rank")
            return AgentStats.from_dict(data)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise


class WeatherDataClient:
    """Client for fetching weather data from OpenWeatherMap."""

    BASE_URL = "https://api.openweathermap.org/data/2.5"

    # Location coordinates for weather data
    LOCATION_COORDS = {
        Location.NYC: (40.7128, -74.0060),
        Location.CHI: (41.8781, -87.6298),
        Location.MIA: (25.7617, -80.1918),
        Location.AUS: (30.2672, -97.7431),
    }

    def __init__(self, api_key: str | None = None) -> None:
        """Initialize weather client.

        Args:
            api_key: OpenWeatherMap API key
        """
        self.api_key = api_key or os.environ.get("OPENWEATHERMAP_API_KEY", "")
        self._client = httpx.Client(timeout=30.0)
        logger.info("weather_client_initialized")

    def get_current_weather(self, location: Location) -> dict[str, Any]:
        """Get current weather for a location.

        Args:
            location: Location to get weather for

        Returns:
            Current weather data
        """
        lat, lon = self.LOCATION_COORDS[location]
        response = self._client.get(
            f"{self.BASE_URL}/weather",
            params={
                "lat": lat,
                "lon": lon,
                "appid": self.api_key,
                "units": "imperial",
            },
        )
        response.raise_for_status()
        data = response.json()

        logger.info(
            "current_weather_fetched",
            location=location.value,
            temp=data.get("main", {}).get("temp"),
        )

        return {
            "location": location.value,
            "temperature": data.get("main", {}).get("temp"),
            "feels_like": data.get("main", {}).get("feels_like"),
            "temp_min": data.get("main", {}).get("temp_min"),
            "temp_max": data.get("main", {}).get("temp_max"),
            "humidity": data.get("main", {}).get("humidity"),
            "pressure": data.get("main", {}).get("pressure"),
            "wind_speed": data.get("wind", {}).get("speed"),
            "wind_direction": data.get("wind", {}).get("deg"),
            "clouds": data.get("clouds", {}).get("all"),
            "weather_condition": data.get("weather", [{}])[0].get("main"),
            "weather_description": data.get("weather", [{}])[0].get("description"),
            "timestamp": datetime.now().isoformat(),
        }

    def get_forecast(self, location: Location, days: int = 5) -> dict[str, Any]:
        """Get weather forecast for a location.

        Args:
            location: Location to get forecast for
            days: Number of days (max 5 for free tier)

        Returns:
            Forecast data
        """
        lat, lon = self.LOCATION_COORDS[location]
        response = self._client.get(
            f"{self.BASE_URL}/forecast",
            params={
                "lat": lat,
                "lon": lon,
                "appid": self.api_key,
                "units": "imperial",
                "cnt": min(days * 8, 40),  # 8 forecasts per day, max 40
            },
        )
        response.raise_for_status()
        data = response.json()

        forecasts = []
        for item in data.get("list", []):
            forecasts.append({
                "datetime": item.get("dt_txt"),
                "temperature": item.get("main", {}).get("temp"),
                "temp_min": item.get("main", {}).get("temp_min"),
                "temp_max": item.get("main", {}).get("temp_max"),
                "humidity": item.get("main", {}).get("humidity"),
                "weather_condition": item.get("weather", [{}])[0].get("main"),
                "precipitation_probability": item.get("pop", 0) * 100,
                "rain_volume": item.get("rain", {}).get("3h", 0),
                "snow_volume": item.get("snow", {}).get("3h", 0),
            })

        logger.info(
            "forecast_fetched",
            location=location.value,
            forecasts_count=len(forecasts),
        )

        return {
            "location": location.value,
            "forecasts": forecasts,
            "generated_at": datetime.now().isoformat(),
        }

    def get_weather_for_market(
        self,
        market_type: MarketType,
        location: Location,
    ) -> dict[str, Any]:
        """Get relevant weather data for a specific market type.

        Args:
            market_type: Type of weather market
            location: Location

        Returns:
            Relevant weather data for the market
        """
        current = self.get_current_weather(location)
        forecast = self.get_forecast(location, days=2)

        return {
            "current": current,
            "forecast": forecast,
            "market_type": market_type.value,
            "relevant_metrics": self._get_relevant_metrics(market_type, current, forecast),
        }

    def _get_relevant_metrics(
        self,
        market_type: MarketType,
        current: dict[str, Any],
        forecast: dict[str, Any],
    ) -> dict[str, Any]:
        """Extract metrics relevant to market type."""
        forecasts = forecast.get("forecasts", [])

        if market_type == MarketType.TEMPERATURE_HIGH:
            return {
                "current_temp": current.get("temperature"),
                "current_max": current.get("temp_max"),
                "forecast_highs": [f.get("temp_max") for f in forecasts[:8]],
                "trend": "rising" if forecasts and forecasts[0].get("temp_max", 0) > current.get("temp_max", 0) else "falling",
            }

        elif market_type == MarketType.TEMPERATURE_LOW:
            return {
                "current_temp": current.get("temperature"),
                "current_min": current.get("temp_min"),
                "forecast_lows": [f.get("temp_min") for f in forecasts[:8]],
                "trend": "rising" if forecasts and forecasts[0].get("temp_min", 0) > current.get("temp_min", 0) else "falling",
            }

        elif market_type == MarketType.PRECIPITATION:
            return {
                "current_condition": current.get("weather_condition"),
                "precipitation_chances": [f.get("precipitation_probability") for f in forecasts[:8]],
                "expected_rain": sum(f.get("rain_volume", 0) for f in forecasts[:8]),
                "humidity": current.get("humidity"),
            }

        elif market_type == MarketType.SNOW:
            return {
                "current_temp": current.get("temperature"),
                "current_condition": current.get("weather_condition"),
                "expected_snow": sum(f.get("snow_volume", 0) for f in forecasts[:8]),
                "precipitation_chances": [f.get("precipitation_probability") for f in forecasts[:8]],
            }

        return {}
