"""Agent orchestrator Lambda handler - runs every 15 minutes via EventBridge."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import boto3
import structlog

from common.bedrock import BedrockClient, ConfidenceLevel
from common.dynamodb import (
    Agent,
    AgentStatus,
    DynamoDBClient,
    Position,
    PositionStatus,
    Prediction,
)
from common.telegram import TelegramBot
from common.whether_api import (
    Location,
    Market,
    MarketType,
    WeatherDataClient,
    WhetherAPIClient,
)

logger = structlog.get_logger()

# Environment variables
SECRETS_ARN = os.environ.get("SECRETS_ARN", "")
POSITION_QUEUE_URL = os.environ.get("POSITION_QUEUE_URL", "")

# Cached clients
_secrets_client: Any = None
_sqs_client: Any = None
_db: DynamoDBClient | None = None
_whether_api: WhetherAPIClient | None = None
_weather_client: WeatherDataClient | None = None
_bedrock: BedrockClient | None = None
_bot: TelegramBot | None = None
_secrets: dict[str, str] | None = None


def get_secrets() -> dict[str, str]:
    """Get secrets from Secrets Manager."""
    global _secrets_client, _secrets
    if _secrets is not None:
        return _secrets

    if _secrets_client is None:
        _secrets_client = boto3.client("secretsmanager")

    response = _secrets_client.get_secret_value(SecretId=SECRETS_ARN)
    _secrets = json.loads(response["SecretString"])
    return _secrets


def get_sqs() -> Any:
    """Get SQS client."""
    global _sqs_client
    if _sqs_client is None:
        _sqs_client = boto3.client("sqs")
    return _sqs_client


def get_db() -> DynamoDBClient:
    """Get DynamoDB client."""
    global _db
    if _db is None:
        _db = DynamoDBClient()
    return _db


def get_whether_api() -> WhetherAPIClient:
    """Get Whether API client."""
    global _whether_api
    if _whether_api is None:
        _whether_api = WhetherAPIClient()
    return _whether_api


def get_weather_client() -> WeatherDataClient:
    """Get weather data client."""
    global _weather_client
    if _weather_client is None:
        secrets = get_secrets()
        _weather_client = WeatherDataClient(api_key=secrets.get("openweathermap_api_key"))
    return _weather_client


def get_bedrock() -> BedrockClient:
    """Get Bedrock client."""
    global _bedrock
    if _bedrock is None:
        _bedrock = BedrockClient()
    return _bedrock


def get_bot() -> TelegramBot:
    """Get Telegram bot for notifications."""
    global _bot
    if _bot is None:
        secrets = get_secrets()
        _bot = TelegramBot(token=secrets.get("telegram_bot_token", ""))
    return _bot


# Confidence level ordering for comparisons
CONFIDENCE_ORDER = {
    "low": 0,
    "medium": 1,
    "high": 2,
    "very_high": 3,
}


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Orchestrate agent analysis and trading decisions.

    This Lambda runs every 15 minutes via EventBridge and:
    1. Fetches all active agents
    2. Gets open markets from Whether API
    3. For each agent, analyzes relevant markets
    4. Creates predictions and queues positions for execution

    Args:
        event: EventBridge scheduled event
        context: Lambda context

    Returns:
        Summary of orchestration run
    """
    start_time = datetime.now(timezone.utc)
    logger.info("orchestrator_started", timestamp=start_time.isoformat())

    db = get_db()
    api = get_whether_api()

    # Get active agents
    agents = db.get_active_agents()
    logger.info("active_agents_fetched", count=len(agents))

    if not agents:
        return {
            "statusCode": 200,
            "message": "No active agents",
            "agentsProcessed": 0,
        }

    # Get active markets
    try:
        markets = api.get_active_markets()
        logger.info("active_markets_fetched", count=len(markets))
    except Exception as e:
        logger.exception("markets_fetch_failed", error=str(e))
        return {
            "statusCode": 500,
            "error": "Failed to fetch markets",
        }

    if not markets:
        return {
            "statusCode": 200,
            "message": "No active markets",
            "agentsProcessed": 0,
        }

    # Process each agent
    results = []
    for agent in agents:
        try:
            result = process_agent(agent, markets)
            results.append(result)
        except Exception as e:
            logger.exception(
                "agent_processing_failed",
                agent_id=agent.agent_id,
                error=str(e),
            )
            results.append({
                "agentId": agent.agent_id,
                "error": str(e),
            })

    # Calculate summary
    total_predictions = sum(r.get("predictions", 0) for r in results)
    total_positions_queued = sum(r.get("positionsQueued", 0) for r in results)

    end_time = datetime.now(timezone.utc)
    duration_ms = (end_time - start_time).total_seconds() * 1000

    logger.info(
        "orchestrator_completed",
        agents_processed=len(agents),
        total_predictions=total_predictions,
        total_positions_queued=total_positions_queued,
        duration_ms=duration_ms,
    )

    return {
        "statusCode": 200,
        "agentsProcessed": len(agents),
        "marketsAnalyzed": len(markets),
        "totalPredictions": total_predictions,
        "totalPositionsQueued": total_positions_queued,
        "durationMs": duration_ms,
        "results": results,
    }


def process_agent(agent: Agent, markets: list[Market]) -> dict[str, Any]:
    """Process a single agent against available markets.

    Args:
        agent: Agent to process
        markets: Available markets

    Returns:
        Processing result summary
    """
    logger.info(
        "processing_agent",
        agent_id=agent.agent_id,
        strategy_name=agent.strategy_name,
    )

    db = get_db()
    strategy = agent.strategy_config

    # Filter markets based on strategy
    relevant_markets = filter_markets_for_strategy(markets, strategy)
    logger.info(
        "markets_filtered",
        agent_id=agent.agent_id,
        total_markets=len(markets),
        relevant_markets=len(relevant_markets),
    )

    if not relevant_markets:
        return {
            "agentId": agent.agent_id,
            "marketsAnalyzed": 0,
            "predictions": 0,
            "positionsQueued": 0,
        }

    predictions_created = 0
    positions_queued = 0

    for market in relevant_markets:
        try:
            # Check if we already have a recent prediction for this market
            existing = db.get_prediction_for_market(agent.agent_id, market.id)
            if existing:
                age_seconds = (datetime.now(timezone.utc) - existing.created_at).total_seconds()
                if age_seconds < 3600:  # Skip if prediction is less than 1 hour old
                    logger.debug(
                        "skipping_recent_prediction",
                        agent_id=agent.agent_id,
                        market_id=market.id,
                    )
                    continue

            # Analyze market
            prediction = analyze_market_for_agent(agent, market, strategy)
            if prediction:
                db.create_prediction(prediction)
                predictions_created += 1

                # Check if we should create a position
                if should_open_position(prediction, strategy):
                    queue_position(agent, market, prediction, strategy)
                    positions_queued += 1

        except Exception as e:
            logger.exception(
                "market_analysis_failed",
                agent_id=agent.agent_id,
                market_id=market.id,
                error=str(e),
            )

    # Send notification if positions were queued
    if positions_queued > 0:
        send_agent_notification(
            agent,
            f"Created {positions_queued} new position(s) from {predictions_created} predictions.",
        )

    return {
        "agentId": agent.agent_id,
        "strategyName": agent.strategy_name,
        "marketsAnalyzed": len(relevant_markets),
        "predictions": predictions_created,
        "positionsQueued": positions_queued,
    }


def filter_markets_for_strategy(
    markets: list[Market],
    strategy: dict[str, Any],
) -> list[Market]:
    """Filter markets based on strategy configuration.

    Args:
        markets: All available markets
        strategy: Strategy configuration

    Returns:
        Markets matching strategy criteria
    """
    market_selection = strategy.get("marketSelection", {})
    allowed_types = market_selection.get("types", [])
    allowed_locations = market_selection.get("locations", [])
    time_horizons = market_selection.get("timeHorizon", [])

    filtered = []
    now = datetime.now(timezone.utc)

    for market in markets:
        # Check market type
        if allowed_types and market.type.value not in allowed_types:
            continue

        # Check location
        if allowed_locations and market.location.value not in allowed_locations:
            continue

        # Check time horizon
        if time_horizons:
            hours_until_resolution = (market.resolution_time - now).total_seconds() / 3600

            if "same_day" in time_horizons and hours_until_resolution <= 24:
                pass
            elif "next_day" in time_horizons and 24 < hours_until_resolution <= 48:
                pass
            elif "weekly" in time_horizons and 48 < hours_until_resolution <= 168:
                pass
            else:
                continue

        filtered.append(market)

    return filtered


def analyze_market_for_agent(
    agent: Agent,
    market: Market,
    strategy: dict[str, Any],
) -> Prediction | None:
    """Analyze a market and create prediction.

    Args:
        agent: Agent doing the analysis
        market: Market to analyze
        strategy: Agent's strategy configuration

    Returns:
        Prediction or None if analysis failed
    """
    bedrock = get_bedrock()
    weather_client = get_weather_client()

    # Get weather data for the market
    try:
        weather_data = weather_client.get_weather_for_market(
            market.type,
            market.location,
        )
    except Exception as e:
        logger.warning(
            "weather_fetch_failed",
            market_id=market.id,
            error=str(e),
        )
        weather_data = {}

    # Call Bedrock for analysis
    analysis = bedrock.analyze_market(
        market_id=market.id,
        market_type=market.type.value,
        location=market.location.value,
        question=market.question,
        market_probability=market.yes_probability,
        resolution_time=market.resolution_time.isoformat(),
        weather_data=weather_data,
        strategy_thesis=strategy.get("thesis", ""),
        position_direction=strategy.get("positionDirection", "dynamic"),
    )

    # Create prediction record
    prediction = Prediction.create(
        agent_id=agent.agent_id,
        market_id=market.id,
        predicted_probability=analysis.predicted_probability,
        market_probability=market.yes_probability / 100,
        confidence=analysis.confidence.value,
        edge=analysis.edge,
        reasoning=analysis.reasoning,
        weather_factors=analysis.weather_factors,
        recommended_direction=analysis.recommended_direction.value,
    )

    logger.info(
        "prediction_created",
        agent_id=agent.agent_id,
        market_id=market.id,
        predicted_probability=analysis.predicted_probability,
        edge=analysis.edge,
        confidence=analysis.confidence.value,
    )

    return prediction


def should_open_position(
    prediction: Prediction,
    strategy: dict[str, Any],
) -> bool:
    """Determine if a position should be opened based on prediction and strategy.

    Args:
        prediction: Market prediction
        strategy: Strategy configuration

    Returns:
        True if position should be opened
    """
    risk_controls = strategy.get("riskControls", {})
    entry_conditions = strategy.get("entryConditions", [])

    # Check minimum confidence
    min_confidence = risk_controls.get("minConfidence", "medium")
    prediction_confidence_order = CONFIDENCE_ORDER.get(prediction.confidence, 0)
    required_confidence_order = CONFIDENCE_ORDER.get(min_confidence, 1)

    if prediction_confidence_order < required_confidence_order:
        logger.debug(
            "confidence_too_low",
            prediction_confidence=prediction.confidence,
            required=min_confidence,
        )
        return False

    # Check minimum edge
    min_edge = risk_controls.get("minEdge", 0.05)
    if prediction.edge < min_edge:
        logger.debug(
            "edge_too_low",
            prediction_edge=prediction.edge,
            required=min_edge,
        )
        return False

    # Check entry conditions
    for condition in entry_conditions:
        if not evaluate_entry_condition(condition, prediction):
            return False

    return True


def evaluate_entry_condition(
    condition: dict[str, Any],
    prediction: Prediction,
) -> bool:
    """Evaluate a single entry condition.

    Args:
        condition: Entry condition configuration
        prediction: Current prediction

    Returns:
        True if condition is met
    """
    field = condition.get("field", "")
    operator = condition.get("operator", "")
    value = condition.get("value")

    # Get actual value based on field
    if field == "edge":
        actual = prediction.edge
    elif field == "confidence":
        actual = CONFIDENCE_ORDER.get(prediction.confidence, 0)
        value = CONFIDENCE_ORDER.get(str(value), 1) if isinstance(value, str) else value
    elif field == "market_probability":
        actual = prediction.market_probability * 100
    elif field == "forecast_probability":
        actual = prediction.predicted_probability * 100
    else:
        return True  # Unknown field - pass

    # Evaluate operator
    if operator == "gt":
        return actual > value
    elif operator == "lt":
        return actual < value
    elif operator == "gte":
        return actual >= value
    elif operator == "lte":
        return actual <= value
    elif operator == "eq":
        return actual == value
    else:
        return True


def calculate_position_size(
    prediction: Prediction,
    strategy: dict[str, Any],
    agent: Agent,
) -> Decimal:
    """Calculate position size based on strategy.

    Args:
        prediction: Market prediction
        strategy: Strategy configuration
        agent: Agent placing the position

    Returns:
        Position size in TON
    """
    position_sizing = strategy.get("positionSizing", {})
    risk_controls = strategy.get("riskControls", {})

    base_size = Decimal(str(position_sizing.get("baseSize", 0.05)))
    scaling_rule = position_sizing.get("scalingRule", "fixed")
    max_position = Decimal(str(risk_controls.get("maxPositionSize", 0.20)))

    # Apply scaling rule
    if scaling_rule == "confidence_scaled":
        confidence_multiplier = {
            "low": Decimal("0.5"),
            "medium": Decimal("1.0"),
            "high": Decimal("1.5"),
            "very_high": Decimal("2.0"),
        }.get(prediction.confidence, Decimal("1.0"))
        size = base_size * confidence_multiplier

    elif scaling_rule == "edge_scaled":
        edge_multiplier = Decimal(str(min(prediction.edge * 10, 2.0)))
        size = base_size * edge_multiplier

    elif scaling_rule == "kelly":
        # Simplified Kelly: f = (p*b - q) / b where b=1 (even money approx)
        p = Decimal(str(prediction.predicted_probability))
        q = Decimal("1") - p
        kelly_fraction = max(Decimal("0"), p - q)
        size = base_size * kelly_fraction * Decimal("0.5")  # Half Kelly

    else:  # fixed
        size = base_size

    # Apply maximum
    return min(size, max_position)


def queue_position(
    agent: Agent,
    market: Market,
    prediction: Prediction,
    strategy: dict[str, Any],
) -> None:
    """Queue a position for execution via SQS.

    Args:
        agent: Agent placing the position
        market: Target market
        prediction: Market prediction
        strategy: Strategy configuration
    """
    sqs = get_sqs()

    # Calculate position size
    size = calculate_position_size(prediction, strategy, agent)

    # Determine direction
    direction = prediction.recommended_direction
    if strategy.get("positionDirection") in ["YES", "NO"]:
        direction = strategy["positionDirection"]

    message = {
        "agentId": agent.agent_id,
        "marketId": market.id,
        "direction": direction,
        "size": str(size),
        "predictionId": prediction.prediction_id,
        "entryPrice": str(market.yes_price if direction == "YES" else market.no_price),
        "telegramChatId": agent.telegram_chat_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    sqs.send_message(
        QueueUrl=POSITION_QUEUE_URL,
        MessageBody=json.dumps(message),
        MessageGroupId=agent.agent_id if ".fifo" in POSITION_QUEUE_URL else None,
    )

    logger.info(
        "position_queued",
        agent_id=agent.agent_id,
        market_id=market.id,
        direction=direction,
        size=str(size),
    )


def send_agent_notification(agent: Agent, message: str) -> None:
    """Send notification to agent owner via Telegram.

    Args:
        agent: Agent to notify about
        message: Notification message
    """
    try:
        bot = get_bot()
        full_message = f"Agent Update: {agent.strategy_name}\n\n{message}"
        bot.send_message(agent.telegram_chat_id, full_message)
        logger.info(
            "notification_sent",
            agent_id=agent.agent_id,
            chat_id=agent.telegram_chat_id,
        )
    except Exception as e:
        logger.warning(
            "notification_failed",
            agent_id=agent.agent_id,
            error=str(e),
        )
