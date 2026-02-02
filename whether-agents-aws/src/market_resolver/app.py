"""Market resolver Lambda handler - checks resolved markets and updates positions."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import boto3
import structlog

from common.dynamodb import (
    DynamoDBClient,
    PositionStatus,
)
from common.telegram import TelegramBot
from common.whether_api import MarketStatus, WhetherAPIClient

logger = structlog.get_logger()

# Environment variables
SECRETS_ARN = os.environ.get("SECRETS_ARN", "")

# Cached clients
_secrets_client: Any = None
_db: DynamoDBClient | None = None
_whether_api: WhetherAPIClient | None = None
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


def get_bot() -> TelegramBot:
    """Get Telegram bot for notifications."""
    global _bot
    if _bot is None:
        secrets = get_secrets()
        _bot = TelegramBot(token=secrets.get("telegram_bot_token", ""))
    return _bot


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Check resolved markets and update agent positions and stats.

    Runs daily at noon UTC to:
    1. Fetch recently resolved markets
    2. Update positions with outcomes
    3. Calculate PnL for closed positions
    4. Update agent statistics
    5. Update prediction outcomes

    Args:
        event: EventBridge scheduled event
        context: Lambda context

    Returns:
        Resolution summary
    """
    start_time = datetime.now(timezone.utc)
    logger.info("market_resolver_started", timestamp=start_time.isoformat())

    db = get_db()
    api = get_whether_api()

    # Get resolved markets
    try:
        markets = api.get_markets(status=MarketStatus.RESOLVED.value)
        logger.info("resolved_markets_fetched", count=len(markets))
    except Exception as e:
        logger.exception("markets_fetch_failed", error=str(e))
        return {
            "statusCode": 500,
            "error": "Failed to fetch markets",
        }

    if not markets:
        return {
            "statusCode": 200,
            "message": "No resolved markets",
            "marketsProcessed": 0,
        }

    positions_updated = 0
    predictions_updated = 0
    agents_updated = set()

    for market in markets:
        try:
            # Find all open positions for this market
            # We need to scan positions by market - using GSI or scan
            # For now, scan with filter (optimize later with GSI)
            import boto3 as boto
            from boto3.dynamodb.conditions import Attr

            dynamodb = boto.resource("dynamodb")
            positions_table = dynamodb.Table(db._positions_table_name)

            response = positions_table.scan(
                FilterExpression=(
                    Attr("marketId").eq(market.id)
                    & Attr("status").eq(PositionStatus.OPEN.value)
                )
            )

            for position_item in response.get("Items", []):
                try:
                    result = resolve_position(position_item, market)
                    if result:
                        positions_updated += 1
                        agents_updated.add(position_item.get("agentId"))
                except Exception as e:
                    logger.exception(
                        "position_resolution_failed",
                        position_id=position_item.get("positionId"),
                        error=str(e),
                    )

            # Update predictions for this market
            predictions_table = dynamodb.Table(db._predictions_table_name)
            pred_response = predictions_table.scan(
                FilterExpression=Attr("marketId").eq(market.id)
            )

            for prediction_item in pred_response.get("Items", []):
                try:
                    if prediction_item.get("wasCorrect") is None:
                        update_prediction_outcome(prediction_item, market)
                        predictions_updated += 1
                except Exception as e:
                    logger.warning(
                        "prediction_update_failed",
                        prediction_id=prediction_item.get("predictionId"),
                        error=str(e),
                    )

        except Exception as e:
            logger.exception(
                "market_resolution_failed",
                market_id=market.id,
                error=str(e),
            )

    # Update agent statistics
    for agent_id in agents_updated:
        try:
            update_agent_stats(agent_id)
        except Exception as e:
            logger.warning(
                "agent_stats_update_failed",
                agent_id=agent_id,
                error=str(e),
            )

    end_time = datetime.now(timezone.utc)
    duration_ms = (end_time - start_time).total_seconds() * 1000

    logger.info(
        "market_resolver_completed",
        markets_processed=len(markets),
        positions_updated=positions_updated,
        predictions_updated=predictions_updated,
        agents_updated=len(agents_updated),
        duration_ms=duration_ms,
    )

    return {
        "statusCode": 200,
        "marketsProcessed": len(markets),
        "positionsUpdated": positions_updated,
        "predictionsUpdated": predictions_updated,
        "agentsUpdated": len(agents_updated),
        "durationMs": duration_ms,
    }


def resolve_position(position_item: dict[str, Any], market: Any) -> bool:
    """Resolve a single position based on market outcome.

    Args:
        position_item: DynamoDB position item
        market: Resolved market

    Returns:
        True if position was updated
    """
    db = get_db()

    position_id = position_item["positionId"]
    agent_id = position_item["agentId"]
    direction = position_item["direction"]
    size = Decimal(position_item["size"])
    entry_price = Decimal(position_item["entryPrice"])

    # Determine if position won
    outcome = market.outcome
    won = (direction == "YES" and outcome == "YES") or (
        direction == "NO" and outcome == "NO"
    )

    # Calculate PnL
    # If won: PnL = size * (1 - entry_price) (you paid entry_price, got 1)
    # If lost: PnL = -size * entry_price (you paid entry_price, got 0)
    if won:
        pnl = size * (Decimal("1") - entry_price)
    else:
        pnl = -size * entry_price

    exit_price = Decimal("1") if won else Decimal("0")

    # Update position
    db.update_position_status(
        position_id=position_id,
        status=PositionStatus.CLOSED,
        exit_price=exit_price,
        pnl=pnl,
    )

    logger.info(
        "position_resolved",
        position_id=position_id,
        agent_id=agent_id,
        won=won,
        pnl=str(pnl),
    )

    # Send notification
    agent = db.get_agent(agent_id)
    if agent:
        send_resolution_notification(
            agent.telegram_chat_id,
            agent.strategy_name,
            market.id,
            direction,
            outcome,
            pnl,
        )

    return True


def update_prediction_outcome(
    prediction_item: dict[str, Any],
    market: Any,
) -> None:
    """Update prediction with actual market outcome.

    Args:
        prediction_item: DynamoDB prediction item
        market: Resolved market
    """
    db = get_db()

    prediction_id = prediction_item["predictionId"]
    predicted_direction = prediction_item["recommendedDirection"]

    # Check if prediction was correct
    was_correct = predicted_direction == market.outcome

    db.update_prediction_outcome(
        prediction_id=prediction_id,
        was_correct=was_correct,
        actual_outcome=market.outcome,
    )

    logger.debug(
        "prediction_outcome_updated",
        prediction_id=prediction_id,
        was_correct=was_correct,
    )


def update_agent_stats(agent_id: str) -> None:
    """Recalculate and update agent statistics.

    Args:
        agent_id: Agent to update
    """
    db = get_db()

    # Get all closed positions
    positions = db.get_positions_by_agent(agent_id)
    closed_positions = [p for p in positions if p.status == PositionStatus.CLOSED]

    if not closed_positions:
        return

    total_trades = len(closed_positions)
    winning_trades = sum(1 for p in closed_positions if p.pnl and p.pnl > 0)
    total_pnl = sum(p.pnl for p in closed_positions if p.pnl) or Decimal("0")

    db.update_agent_stats(
        agent_id=agent_id,
        total_trades=total_trades,
        winning_trades=winning_trades,
        total_pnl=total_pnl,
    )

    logger.info(
        "agent_stats_updated",
        agent_id=agent_id,
        total_trades=total_trades,
        winning_trades=winning_trades,
        total_pnl=str(total_pnl),
    )


def send_resolution_notification(
    chat_id: int,
    strategy_name: str,
    market_id: str,
    direction: str,
    outcome: str,
    pnl: Decimal,
) -> None:
    """Send market resolution notification.

    Args:
        chat_id: Telegram chat ID
        strategy_name: Agent strategy name
        market_id: Market identifier
        direction: Position direction
        outcome: Market outcome
        pnl: Profit/loss
    """
    try:
        bot = get_bot()

        result_emoji = "" if pnl >= 0 else ""
        result_text = "WON" if pnl >= 0 else "LOST"

        message = f"""{result_emoji} Position Resolved - {result_text}

Agent: {strategy_name}
Market: {market_id[:12]}...

Your Position: {direction}
Outcome: {outcome}
P&L: {pnl:+.4f} TON

Use /status to see updated performance."""

        bot.send_message(chat_id, message)
        logger.info("resolution_notification_sent", chat_id=chat_id)

    except Exception as e:
        logger.warning(
            "resolution_notification_failed",
            chat_id=chat_id,
            error=str(e),
        )
