"""DynamoDB client for Whether Agents data storage."""

from __future__ import annotations

import os
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
import structlog

logger = structlog.get_logger()


class AgentStatus(str, Enum):
    """Agent status states."""

    PENDING = "pending"
    ACTIVE = "active"
    PAUSED = "paused"
    STOPPED = "stopped"


class PositionStatus(str, Enum):
    """Position status states."""

    PENDING = "pending"
    OPEN = "open"
    CLOSED = "closed"
    CANCELLED = "cancelled"


@dataclass
class Agent:
    """Agent data model."""

    agent_id: str
    user_id: str
    telegram_chat_id: int
    strategy_name: str
    strategy_config: dict[str, Any]
    status: AgentStatus
    created_at: datetime
    updated_at: datetime
    total_trades: int = 0
    winning_trades: int = 0
    total_pnl: Decimal = Decimal("0")
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def create(
        cls,
        user_id: str,
        telegram_chat_id: int,
        strategy_name: str,
        strategy_config: dict[str, Any],
    ) -> Agent:
        """Create a new agent."""
        now = datetime.now(timezone.utc)
        return cls(
            agent_id=str(uuid.uuid4()),
            user_id=user_id,
            telegram_chat_id=telegram_chat_id,
            strategy_name=strategy_name,
            strategy_config=strategy_config,
            status=AgentStatus.PENDING,
            created_at=now,
            updated_at=now,
        )

    @property
    def win_rate(self) -> float:
        """Calculate win rate."""
        if self.total_trades == 0:
            return 0.0
        return self.winning_trades / self.total_trades

    def to_dynamo_item(self) -> dict[str, Any]:
        """Convert to DynamoDB item."""
        return {
            "pk": f"AGENT#{self.agent_id}",
            "sk": "METADATA",
            "gsi1pk": f"USER#{self.user_id}",
            "gsi1sk": f"AGENT#{self.created_at.isoformat()}",
            "agentId": self.agent_id,
            "userId": self.user_id,
            "telegramChatId": self.telegram_chat_id,
            "strategyName": self.strategy_name,
            "strategyConfig": self.strategy_config,
            "status": self.status.value,
            "createdAt": self.created_at.isoformat(),
            "updatedAt": self.updated_at.isoformat(),
            "totalTrades": self.total_trades,
            "winningTrades": self.winning_trades,
            "totalPnl": str(self.total_pnl),
            "metadata": self.metadata,
            "entityType": "Agent",
        }

    @classmethod
    def from_dynamo_item(cls, item: dict[str, Any]) -> Agent:
        """Create from DynamoDB item."""
        return cls(
            agent_id=item["agentId"],
            user_id=item["userId"],
            telegram_chat_id=item["telegramChatId"],
            strategy_name=item["strategyName"],
            strategy_config=item["strategyConfig"],
            status=AgentStatus(item["status"]),
            created_at=datetime.fromisoformat(item["createdAt"]),
            updated_at=datetime.fromisoformat(item["updatedAt"]),
            total_trades=item.get("totalTrades", 0),
            winning_trades=item.get("winningTrades", 0),
            total_pnl=Decimal(item.get("totalPnl", "0")),
            metadata=item.get("metadata", {}),
        )


@dataclass
class Position:
    """Position data model."""

    position_id: str
    agent_id: str
    market_id: str
    direction: str
    size: Decimal
    entry_price: Decimal
    status: PositionStatus
    created_at: datetime
    updated_at: datetime
    exit_price: Decimal | None = None
    pnl: Decimal | None = None
    prediction_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def create(
        cls,
        agent_id: str,
        market_id: str,
        direction: str,
        size: Decimal,
        entry_price: Decimal,
        prediction_id: str | None = None,
    ) -> Position:
        """Create a new position."""
        now = datetime.now(timezone.utc)
        return cls(
            position_id=str(uuid.uuid4()),
            agent_id=agent_id,
            market_id=market_id,
            direction=direction,
            size=size,
            entry_price=entry_price,
            status=PositionStatus.PENDING,
            created_at=now,
            updated_at=now,
            prediction_id=prediction_id,
        )

    def to_dynamo_item(self) -> dict[str, Any]:
        """Convert to DynamoDB item."""
        item = {
            "pk": f"POSITION#{self.position_id}",
            "sk": "METADATA",
            "gsi1pk": f"AGENT#{self.agent_id}",
            "gsi1sk": f"POSITION#{self.created_at.isoformat()}",
            "positionId": self.position_id,
            "agentId": self.agent_id,
            "marketId": self.market_id,
            "direction": self.direction,
            "size": str(self.size),
            "entryPrice": str(self.entry_price),
            "status": self.status.value,
            "createdAt": self.created_at.isoformat(),
            "updatedAt": self.updated_at.isoformat(),
            "metadata": self.metadata,
            "entityType": "Position",
            "ttl": int(time.time()) + (90 * 24 * 60 * 60),  # 90 day TTL
        }
        if self.exit_price is not None:
            item["exitPrice"] = str(self.exit_price)
        if self.pnl is not None:
            item["pnl"] = str(self.pnl)
        if self.prediction_id is not None:
            item["predictionId"] = self.prediction_id
        return item

    @classmethod
    def from_dynamo_item(cls, item: dict[str, Any]) -> Position:
        """Create from DynamoDB item."""
        return cls(
            position_id=item["positionId"],
            agent_id=item["agentId"],
            market_id=item["marketId"],
            direction=item["direction"],
            size=Decimal(item["size"]),
            entry_price=Decimal(item["entryPrice"]),
            status=PositionStatus(item["status"]),
            created_at=datetime.fromisoformat(item["createdAt"]),
            updated_at=datetime.fromisoformat(item["updatedAt"]),
            exit_price=Decimal(item["exitPrice"]) if item.get("exitPrice") else None,
            pnl=Decimal(item["pnl"]) if item.get("pnl") else None,
            prediction_id=item.get("predictionId"),
            metadata=item.get("metadata", {}),
        )


@dataclass
class Prediction:
    """Prediction data model."""

    prediction_id: str
    agent_id: str
    market_id: str
    predicted_probability: float
    market_probability: float
    confidence: str
    edge: float
    reasoning: str
    weather_factors: list[str]
    recommended_direction: str
    created_at: datetime
    was_correct: bool | None = None
    actual_outcome: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def create(
        cls,
        agent_id: str,
        market_id: str,
        predicted_probability: float,
        market_probability: float,
        confidence: str,
        edge: float,
        reasoning: str,
        weather_factors: list[str],
        recommended_direction: str,
    ) -> Prediction:
        """Create a new prediction."""
        return cls(
            prediction_id=str(uuid.uuid4()),
            agent_id=agent_id,
            market_id=market_id,
            predicted_probability=predicted_probability,
            market_probability=market_probability,
            confidence=confidence,
            edge=edge,
            reasoning=reasoning,
            weather_factors=weather_factors,
            recommended_direction=recommended_direction,
            created_at=datetime.now(timezone.utc),
        )

    def to_dynamo_item(self) -> dict[str, Any]:
        """Convert to DynamoDB item."""
        item = {
            "pk": f"PREDICTION#{self.prediction_id}",
            "sk": "METADATA",
            "gsi1pk": f"AGENT#{self.agent_id}",
            "gsi1sk": f"PREDICTION#{self.created_at.isoformat()}",
            "predictionId": self.prediction_id,
            "agentId": self.agent_id,
            "marketId": self.market_id,
            "predictedProbability": Decimal(str(self.predicted_probability)),
            "marketProbability": Decimal(str(self.market_probability)),
            "confidence": self.confidence,
            "edge": Decimal(str(self.edge)),
            "reasoning": self.reasoning,
            "weatherFactors": self.weather_factors,
            "recommendedDirection": self.recommended_direction,
            "createdAt": self.created_at.isoformat(),
            "metadata": self.metadata,
            "entityType": "Prediction",
            "ttl": int(time.time()) + (30 * 24 * 60 * 60),  # 30 day TTL
        }
        if self.was_correct is not None:
            item["wasCorrect"] = self.was_correct
        if self.actual_outcome is not None:
            item["actualOutcome"] = self.actual_outcome
        return item

    @classmethod
    def from_dynamo_item(cls, item: dict[str, Any]) -> Prediction:
        """Create from DynamoDB item."""
        return cls(
            prediction_id=item["predictionId"],
            agent_id=item["agentId"],
            market_id=item["marketId"],
            predicted_probability=float(item["predictedProbability"]),
            market_probability=float(item["marketProbability"]),
            confidence=item["confidence"],
            edge=float(item["edge"]),
            reasoning=item["reasoning"],
            weather_factors=item["weatherFactors"],
            recommended_direction=item["recommendedDirection"],
            created_at=datetime.fromisoformat(item["createdAt"]),
            was_correct=item.get("wasCorrect"),
            actual_outcome=item.get("actualOutcome"),
            metadata=item.get("metadata", {}),
        )


@dataclass
class LeaderboardEntry:
    """Leaderboard entry data model."""

    agent_id: str
    strategy_name: str
    user_id: str
    score: Decimal
    total_trades: int
    win_rate: float
    total_pnl: Decimal
    rank: int
    period: str
    updated_at: datetime

    def to_dynamo_item(self) -> dict[str, Any]:
        """Convert to DynamoDB item."""
        return {
            "pk": f"LEADERBOARD#{self.period}",
            "sk": f"RANK#{self.rank:05d}",
            "gsi1pk": f"AGENT#{self.agent_id}",
            "score": self.score,
            "agentId": self.agent_id,
            "strategyName": self.strategy_name,
            "userId": self.user_id,
            "totalTrades": self.total_trades,
            "winRate": Decimal(str(self.win_rate)),
            "totalPnl": self.total_pnl,
            "rank": self.rank,
            "period": self.period,
            "updatedAt": self.updated_at.isoformat(),
            "entityType": "LeaderboardEntry",
        }

    @classmethod
    def from_dynamo_item(cls, item: dict[str, Any]) -> LeaderboardEntry:
        """Create from DynamoDB item."""
        return cls(
            agent_id=item["agentId"],
            strategy_name=item["strategyName"],
            user_id=item["userId"],
            score=item["score"],
            total_trades=item["totalTrades"],
            win_rate=float(item["winRate"]),
            total_pnl=item["totalPnl"],
            rank=item["rank"],
            period=item["period"],
            updated_at=datetime.fromisoformat(item["updatedAt"]),
        )


class DynamoDBClient:
    """DynamoDB client for Whether Agents."""

    def __init__(
        self,
        agents_table: str | None = None,
        positions_table: str | None = None,
        predictions_table: str | None = None,
        leaderboard_table: str | None = None,
        region: str | None = None,
    ) -> None:
        """Initialize DynamoDB client.

        Args:
            agents_table: Agents table name (defaults to env var)
            positions_table: Positions table name (defaults to env var)
            predictions_table: Predictions table name (defaults to env var)
            leaderboard_table: Leaderboard table name (defaults to env var)
            region: AWS region (defaults to env var)
        """
        self.region = region or os.environ.get("AWS_REGION", "us-east-1")
        self._dynamodb = boto3.resource("dynamodb", region_name=self.region)

        self._agents_table_name = agents_table or os.environ.get("AGENTS_TABLE", "whether-agents-dev")
        self._positions_table_name = positions_table or os.environ.get("POSITIONS_TABLE", "whether-positions-dev")
        self._predictions_table_name = predictions_table or os.environ.get("PREDICTIONS_TABLE", "whether-predictions-dev")
        self._leaderboard_table_name = leaderboard_table or os.environ.get("LEADERBOARD_TABLE", "whether-leaderboard-dev")

        self._agents_table = self._dynamodb.Table(self._agents_table_name)
        self._positions_table = self._dynamodb.Table(self._positions_table_name)
        self._predictions_table = self._dynamodb.Table(self._predictions_table_name)
        self._leaderboard_table = self._dynamodb.Table(self._leaderboard_table_name)

        logger.info(
            "dynamodb_client_initialized",
            agents_table=self._agents_table_name,
            positions_table=self._positions_table_name,
            predictions_table=self._predictions_table_name,
            leaderboard_table=self._leaderboard_table_name,
        )

    # =========================================================================
    # AGENT OPERATIONS
    # =========================================================================

    def create_agent(self, agent: Agent) -> Agent:
        """Create a new agent."""
        self._agents_table.put_item(Item=agent.to_dynamo_item())
        logger.info("agent_created", agent_id=agent.agent_id, user_id=agent.user_id)
        return agent

    def get_agent(self, agent_id: str) -> Agent | None:
        """Get agent by ID."""
        response = self._agents_table.get_item(
            Key={"pk": f"AGENT#{agent_id}", "sk": "METADATA"}
        )
        item = response.get("Item")
        if not item:
            return None
        return Agent.from_dynamo_item(item)

    def get_agents_by_user(self, user_id: str) -> list[Agent]:
        """Get all agents for a user."""
        response = self._agents_table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("gsi1pk").eq(f"USER#{user_id}"),
        )
        return [Agent.from_dynamo_item(item) for item in response.get("Items", [])]

    def get_active_agents(self) -> list[Agent]:
        """Get all active agents."""
        response = self._agents_table.scan(
            FilterExpression="entityType = :et AND #s = :status",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":et": "Agent",
                ":status": AgentStatus.ACTIVE.value,
            },
        )
        return [Agent.from_dynamo_item(item) for item in response.get("Items", [])]

    def update_agent_status(self, agent_id: str, status: AgentStatus) -> None:
        """Update agent status."""
        now = datetime.now(timezone.utc)
        self._agents_table.update_item(
            Key={"pk": f"AGENT#{agent_id}", "sk": "METADATA"},
            UpdateExpression="SET #s = :status, updatedAt = :updated",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":status": status.value,
                ":updated": now.isoformat(),
            },
        )
        logger.info("agent_status_updated", agent_id=agent_id, status=status.value)

    def update_agent_stats(
        self,
        agent_id: str,
        total_trades: int,
        winning_trades: int,
        total_pnl: Decimal,
    ) -> None:
        """Update agent trading statistics."""
        now = datetime.now(timezone.utc)
        self._agents_table.update_item(
            Key={"pk": f"AGENT#{agent_id}", "sk": "METADATA"},
            UpdateExpression="SET totalTrades = :tt, winningTrades = :wt, totalPnl = :pnl, updatedAt = :updated",
            ExpressionAttributeValues={
                ":tt": total_trades,
                ":wt": winning_trades,
                ":pnl": str(total_pnl),
                ":updated": now.isoformat(),
            },
        )
        logger.info(
            "agent_stats_updated",
            agent_id=agent_id,
            total_trades=total_trades,
            winning_trades=winning_trades,
            total_pnl=str(total_pnl),
        )

    # =========================================================================
    # POSITION OPERATIONS
    # =========================================================================

    def create_position(self, position: Position) -> Position:
        """Create a new position."""
        self._positions_table.put_item(Item=position.to_dynamo_item())
        logger.info(
            "position_created",
            position_id=position.position_id,
            agent_id=position.agent_id,
            market_id=position.market_id,
        )
        return position

    def get_position(self, position_id: str) -> Position | None:
        """Get position by ID."""
        response = self._positions_table.get_item(
            Key={"pk": f"POSITION#{position_id}", "sk": "METADATA"}
        )
        item = response.get("Item")
        if not item:
            return None
        return Position.from_dynamo_item(item)

    def get_positions_by_agent(
        self,
        agent_id: str,
        status: PositionStatus | None = None,
    ) -> list[Position]:
        """Get positions for an agent."""
        response = self._positions_table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("gsi1pk").eq(f"AGENT#{agent_id}"),
        )
        positions = [Position.from_dynamo_item(item) for item in response.get("Items", [])]
        if status:
            positions = [p for p in positions if p.status == status]
        return positions

    def update_position_status(
        self,
        position_id: str,
        status: PositionStatus,
        exit_price: Decimal | None = None,
        pnl: Decimal | None = None,
    ) -> None:
        """Update position status."""
        now = datetime.now(timezone.utc)
        update_expr = "SET #s = :status, updatedAt = :updated"
        expr_names = {"#s": "status"}
        expr_values: dict[str, Any] = {
            ":status": status.value,
            ":updated": now.isoformat(),
        }

        if exit_price is not None:
            update_expr += ", exitPrice = :exit"
            expr_values[":exit"] = str(exit_price)

        if pnl is not None:
            update_expr += ", pnl = :pnl"
            expr_values[":pnl"] = str(pnl)

        self._positions_table.update_item(
            Key={"pk": f"POSITION#{position_id}", "sk": "METADATA"},
            UpdateExpression=update_expr,
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values,
        )
        logger.info(
            "position_status_updated",
            position_id=position_id,
            status=status.value,
            pnl=str(pnl) if pnl else None,
        )

    # =========================================================================
    # PREDICTION OPERATIONS
    # =========================================================================

    def create_prediction(self, prediction: Prediction) -> Prediction:
        """Create a new prediction."""
        self._predictions_table.put_item(Item=prediction.to_dynamo_item())
        logger.info(
            "prediction_created",
            prediction_id=prediction.prediction_id,
            agent_id=prediction.agent_id,
            market_id=prediction.market_id,
        )
        return prediction

    def get_prediction(self, prediction_id: str) -> Prediction | None:
        """Get prediction by ID."""
        response = self._predictions_table.get_item(
            Key={"pk": f"PREDICTION#{prediction_id}", "sk": "METADATA"}
        )
        item = response.get("Item")
        if not item:
            return None
        return Prediction.from_dynamo_item(item)

    def get_predictions_by_agent(
        self,
        agent_id: str,
        limit: int = 50,
    ) -> list[Prediction]:
        """Get recent predictions for an agent."""
        response = self._predictions_table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("gsi1pk").eq(f"AGENT#{agent_id}"),
            ScanIndexForward=False,
            Limit=limit,
        )
        return [Prediction.from_dynamo_item(item) for item in response.get("Items", [])]

    def get_prediction_for_market(
        self,
        agent_id: str,
        market_id: str,
    ) -> Prediction | None:
        """Get most recent prediction for a specific market."""
        predictions = self.get_predictions_by_agent(agent_id, limit=100)
        for pred in predictions:
            if pred.market_id == market_id:
                return pred
        return None

    def update_prediction_outcome(
        self,
        prediction_id: str,
        was_correct: bool,
        actual_outcome: str,
    ) -> None:
        """Update prediction with actual outcome."""
        self._predictions_table.update_item(
            Key={"pk": f"PREDICTION#{prediction_id}", "sk": "METADATA"},
            UpdateExpression="SET wasCorrect = :correct, actualOutcome = :outcome",
            ExpressionAttributeValues={
                ":correct": was_correct,
                ":outcome": actual_outcome,
            },
        )
        logger.info(
            "prediction_outcome_updated",
            prediction_id=prediction_id,
            was_correct=was_correct,
        )

    # =========================================================================
    # LEADERBOARD OPERATIONS
    # =========================================================================

    def update_leaderboard(self, entries: list[LeaderboardEntry]) -> None:
        """Update leaderboard entries."""
        with self._leaderboard_table.batch_writer() as batch:
            for entry in entries:
                batch.put_item(Item=entry.to_dynamo_item())
        logger.info("leaderboard_updated", entries_count=len(entries))

    def get_leaderboard(
        self,
        period: str = "all_time",
        limit: int = 100,
    ) -> list[LeaderboardEntry]:
        """Get leaderboard for a period."""
        response = self._leaderboard_table.query(
            KeyConditionExpression=Key("pk").eq(f"LEADERBOARD#{period}"),
            ScanIndexForward=True,
            Limit=limit,
        )
        return [LeaderboardEntry.from_dynamo_item(item) for item in response.get("Items", [])]

    def get_agent_rank(self, agent_id: str, period: str = "all_time") -> int | None:
        """Get agent's rank in leaderboard."""
        response = self._leaderboard_table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("gsi1pk").eq(f"AGENT#{agent_id}"),
        )
        items = response.get("Items", [])
        for item in items:
            if item.get("period") == period:
                return item.get("rank")
        return None
