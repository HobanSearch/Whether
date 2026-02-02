"""Leaderboard updater Lambda handler - runs hourly via EventBridge."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import structlog

from common.dynamodb import (
    AgentStatus,
    DynamoDBClient,
    LeaderboardEntry,
    PositionStatus,
)

logger = structlog.get_logger()

# Cached client
_db: DynamoDBClient | None = None


def get_db() -> DynamoDBClient:
    """Get DynamoDB client."""
    global _db
    if _db is None:
        _db = DynamoDBClient()
    return _db


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Update agent leaderboard rankings.

    Runs hourly to recalculate rankings based on:
    - Win rate (40% weight)
    - Total PnL (30% weight)
    - Number of trades (20% weight)
    - Prediction accuracy (10% weight)

    Args:
        event: EventBridge scheduled event
        context: Lambda context

    Returns:
        Update summary
    """
    start_time = datetime.now(timezone.utc)
    logger.info("leaderboard_updater_started", timestamp=start_time.isoformat())

    db = get_db()

    # Get all agents with at least one trade
    agents = []
    for status in [AgentStatus.ACTIVE, AgentStatus.PAUSED]:
        agents.extend(db.get_active_agents() if status == AgentStatus.ACTIVE else [])

    # Actually we need to get all agents, not just active ones
    # For now, let's scan the agents table
    from boto3.dynamodb.conditions import Attr
    import boto3

    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(db._agents_table_name)

    response = table.scan(
        FilterExpression=Attr("entityType").eq("Agent") & Attr("totalTrades").gt(0)
    )
    agent_items = response.get("Items", [])

    logger.info("agents_to_rank", count=len(agent_items))

    if not agent_items:
        return {
            "statusCode": 200,
            "message": "No agents to rank",
            "agentsRanked": 0,
        }

    # Calculate scores and rankings
    agent_scores = []

    for item in agent_items:
        agent_id = item.get("agentId", "")
        total_trades = item.get("totalTrades", 0)
        winning_trades = item.get("winningTrades", 0)
        total_pnl = Decimal(item.get("totalPnl", "0"))

        # Calculate win rate
        win_rate = winning_trades / total_trades if total_trades > 0 else 0

        # Get prediction accuracy
        predictions = db.get_predictions_by_agent(agent_id, limit=100)
        correct_predictions = sum(1 for p in predictions if p.was_correct is True)
        total_with_outcome = sum(1 for p in predictions if p.was_correct is not None)
        prediction_accuracy = (
            correct_predictions / total_with_outcome if total_with_outcome > 0 else 0
        )

        # Calculate composite score
        # Weights: win_rate (40%), pnl (30%), trades (20%), accuracy (10%)
        normalized_pnl = float(total_pnl) / 100  # Normalize PnL to roughly 0-1 range
        normalized_trades = min(total_trades / 100, 1.0)  # Cap at 100 trades

        score = (
            win_rate * 0.4
            + max(min(normalized_pnl, 1.0), -1.0) * 0.3  # Clamp to -1 to 1
            + normalized_trades * 0.2
            + prediction_accuracy * 0.1
        )

        agent_scores.append({
            "agent_id": agent_id,
            "strategy_name": item.get("strategyName", "Unknown"),
            "user_id": item.get("userId", ""),
            "total_trades": total_trades,
            "winning_trades": winning_trades,
            "win_rate": win_rate,
            "total_pnl": total_pnl,
            "score": Decimal(str(round(score, 6))),
        })

    # Sort by score descending
    agent_scores.sort(key=lambda x: float(x["score"]), reverse=True)

    # Create leaderboard entries for different periods
    now = datetime.now(timezone.utc)
    periods = ["all_time", "weekly", "daily"]

    for period in periods:
        entries = []
        for rank, agent_data in enumerate(agent_scores, start=1):
            entry = LeaderboardEntry(
                agent_id=agent_data["agent_id"],
                strategy_name=agent_data["strategy_name"],
                user_id=agent_data["user_id"],
                score=agent_data["score"],
                total_trades=agent_data["total_trades"],
                win_rate=agent_data["win_rate"],
                total_pnl=agent_data["total_pnl"],
                rank=rank,
                period=period,
                updated_at=now,
            )
            entries.append(entry)

        # Update leaderboard
        db.update_leaderboard(entries)
        logger.info("leaderboard_period_updated", period=period, entries=len(entries))

    end_time = datetime.now(timezone.utc)
    duration_ms = (end_time - start_time).total_seconds() * 1000

    logger.info(
        "leaderboard_updater_completed",
        agents_ranked=len(agent_scores),
        duration_ms=duration_ms,
    )

    return {
        "statusCode": 200,
        "agentsRanked": len(agent_scores),
        "periodsUpdated": periods,
        "durationMs": duration_ms,
    }
