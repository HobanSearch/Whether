"""Position executor Lambda handler - processes SQS position queue."""

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
    Position,
    PositionStatus,
)
from common.telegram import TelegramBot
from common.whether_api import WhetherAPIClient

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
    """Execute positions from SQS queue.

    Processes position execution requests from the queue, creating
    paper trading positions via the Whether API.

    Args:
        event: SQS event with position records
        context: Lambda context

    Returns:
        Batch item failure report for partial failures
    """
    logger.info(
        "position_executor_started",
        records_count=len(event.get("Records", [])),
    )

    batch_item_failures = []

    for record in event.get("Records", []):
        try:
            message_id = record.get("messageId", "")
            body = json.loads(record.get("body", "{}"))

            logger.info(
                "processing_position",
                message_id=message_id,
                agent_id=body.get("agentId"),
                market_id=body.get("marketId"),
            )

            process_position_message(body)

        except Exception as e:
            logger.exception(
                "position_processing_failed",
                message_id=record.get("messageId"),
                error=str(e),
            )
            batch_item_failures.append({
                "itemIdentifier": record.get("messageId"),
            })

    logger.info(
        "position_executor_completed",
        processed=len(event.get("Records", [])) - len(batch_item_failures),
        failures=len(batch_item_failures),
    )

    return {
        "batchItemFailures": batch_item_failures,
    }


def process_position_message(message: dict[str, Any]) -> None:
    """Process a single position execution message.

    Args:
        message: Position execution request
    """
    db = get_db()
    api = get_whether_api()

    agent_id = message["agentId"]
    market_id = message["marketId"]
    direction = message["direction"]
    size = Decimal(message["size"])
    entry_price = Decimal(message["entryPrice"])
    prediction_id = message.get("predictionId")
    telegram_chat_id = message.get("telegramChatId")

    # Verify agent is still active
    agent = db.get_agent(agent_id)
    if not agent:
        logger.warning("agent_not_found", agent_id=agent_id)
        return

    if agent.status.value != "active":
        logger.info(
            "agent_not_active",
            agent_id=agent_id,
            status=agent.status.value,
        )
        return

    # Create paper position
    try:
        paper_position = api.create_paper_position(
            agent_id=agent_id,
            market_id=market_id,
            direction=direction,
            amount=size,
        )

        # Store position in DynamoDB
        position = Position.create(
            agent_id=agent_id,
            market_id=market_id,
            direction=direction,
            size=size,
            entry_price=entry_price,
            prediction_id=prediction_id,
        )
        position.status = PositionStatus.OPEN
        db.create_position(position)

        logger.info(
            "position_created",
            position_id=position.position_id,
            agent_id=agent_id,
            market_id=market_id,
            direction=direction,
            size=str(size),
        )

        # Send notification
        if telegram_chat_id:
            send_position_notification(
                telegram_chat_id,
                agent.strategy_name,
                market_id,
                direction,
                size,
                entry_price,
            )

    except Exception as e:
        logger.exception(
            "paper_position_creation_failed",
            agent_id=agent_id,
            market_id=market_id,
            error=str(e),
        )
        raise


def send_position_notification(
    chat_id: int,
    strategy_name: str,
    market_id: str,
    direction: str,
    size: Decimal,
    entry_price: Decimal,
) -> None:
    """Send position notification via Telegram.

    Args:
        chat_id: Telegram chat ID
        strategy_name: Agent strategy name
        market_id: Market identifier
        direction: Position direction (YES/NO)
        size: Position size
        entry_price: Entry price
    """
    try:
        bot = get_bot()
        message = f"""Position Opened

Agent: {strategy_name}
Market: {market_id[:12]}...

Direction: {direction}
Size: {size} TON
Entry Price: {entry_price}

Use /status to track performance."""

        bot.send_message(chat_id, message)
        logger.info("position_notification_sent", chat_id=chat_id)

    except Exception as e:
        logger.warning(
            "position_notification_failed",
            chat_id=chat_id,
            error=str(e),
        )
