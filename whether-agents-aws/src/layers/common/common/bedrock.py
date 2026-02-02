"""Amazon Bedrock client for strategy synthesis and market analysis."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from enum import Enum
from typing import Any

import boto3
import structlog

logger = structlog.get_logger()


class ConfidenceLevel(str, Enum):
    """Confidence level for predictions."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"


class PositionDirection(str, Enum):
    """Position direction for trading."""

    YES = "YES"
    NO = "NO"
    DYNAMIC = "dynamic"


class ScalingRule(str, Enum):
    """Position sizing scaling rules."""

    FIXED = "fixed"
    CONFIDENCE_SCALED = "confidence_scaled"
    EDGE_SCALED = "edge_scaled"
    KELLY = "kelly"


@dataclass
class MarketSelection:
    """Market selection criteria from synthesized strategy."""

    types: list[str]
    locations: list[str]
    time_horizon: list[str]


@dataclass
class EntryCondition:
    """Entry condition for trading signals."""

    field: str
    operator: str
    value: float | str


@dataclass
class PositionSizing:
    """Position sizing configuration."""

    base_size: float
    scaling_rule: ScalingRule


@dataclass
class RiskControls:
    """Risk control parameters."""

    min_confidence: ConfidenceLevel
    min_edge: float
    max_position_size: float = 0.20
    max_daily_trades: int = 10


@dataclass
class SynthesizedStrategy:
    """Synthesized trading strategy from natural language."""

    strategy_name: str
    thesis: str
    market_selection: MarketSelection
    entry_conditions: list[EntryCondition]
    position_direction: PositionDirection
    position_sizing: PositionSizing
    risk_controls: RiskControls
    raw_response: str

    def to_dict(self) -> dict[str, Any]:
        """Convert strategy to dictionary for storage."""
        return {
            "strategyName": self.strategy_name,
            "thesis": self.thesis,
            "marketSelection": {
                "types": self.market_selection.types,
                "locations": self.market_selection.locations,
                "timeHorizon": self.market_selection.time_horizon,
            },
            "entryConditions": [
                {"field": c.field, "operator": c.operator, "value": c.value}
                for c in self.entry_conditions
            ],
            "positionDirection": self.position_direction.value,
            "positionSizing": {
                "baseSize": self.position_sizing.base_size,
                "scalingRule": self.position_sizing.scaling_rule.value,
            },
            "riskControls": {
                "minConfidence": self.risk_controls.min_confidence.value,
                "minEdge": self.risk_controls.min_edge,
                "maxPositionSize": self.risk_controls.max_position_size,
                "maxDailyTrades": self.risk_controls.max_daily_trades,
            },
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any], raw_response: str = "") -> SynthesizedStrategy:
        """Create strategy from dictionary."""
        return cls(
            strategy_name=data["strategyName"],
            thesis=data["thesis"],
            market_selection=MarketSelection(
                types=data["marketSelection"]["types"],
                locations=data["marketSelection"]["locations"],
                time_horizon=data["marketSelection"]["timeHorizon"],
            ),
            entry_conditions=[
                EntryCondition(
                    field=c["field"],
                    operator=c["operator"],
                    value=c["value"],
                )
                for c in data["entryConditions"]
            ],
            position_direction=PositionDirection(data["positionDirection"]),
            position_sizing=PositionSizing(
                base_size=data["positionSizing"]["baseSize"],
                scaling_rule=ScalingRule(data["positionSizing"]["scalingRule"]),
            ),
            risk_controls=RiskControls(
                min_confidence=ConfidenceLevel(data["riskControls"]["minConfidence"]),
                min_edge=data["riskControls"]["minEdge"],
                max_position_size=data["riskControls"].get("maxPositionSize", 0.20),
                max_daily_trades=data["riskControls"].get("maxDailyTrades", 10),
            ),
            raw_response=raw_response,
        )


@dataclass
class MarketPrediction:
    """Market prediction from AI analysis."""

    market_id: str
    predicted_probability: float
    confidence: ConfidenceLevel
    edge: float
    reasoning: str
    weather_factors: list[str]
    recommended_direction: PositionDirection
    recommended_size: float


STRATEGY_SYNTHESIS_PROMPT = """You are an expert weather trading strategist. A user will describe their trading strategy in natural language, and you must synthesize it into a structured trading configuration.

Available market types: ["temperature_high", "temperature_low", "precipitation", "snow"]
Available locations: ["NYC", "CHI", "MIA", "AUS"]
Available time horizons: ["same_day", "next_day", "weekly"]

Entry condition operators: ["gt", "lt", "gte", "lte", "eq", "between"]
Entry condition fields: ["market_probability", "forecast_probability", "edge", "confidence", "temperature_delta", "precipitation_chance"]

User's strategy description:
{user_input}

Respond with a JSON object following this exact schema:
{{
  "strategyName": "Short descriptive name (2-4 words)",
  "thesis": "One sentence explaining the core trading thesis",
  "marketSelection": {{
    "types": ["array of market types to trade"],
    "locations": ["array of location codes"],
    "timeHorizon": ["array of time horizons"]
  }},
  "entryConditions": [
    {{"field": "field_name", "operator": "operator", "value": numeric_or_string_value}}
  ],
  "positionDirection": "YES|NO|dynamic",
  "positionSizing": {{
    "baseSize": 0.05,
    "scalingRule": "fixed|confidence_scaled|edge_scaled|kelly"
  }},
  "riskControls": {{
    "minConfidence": "low|medium|high|very_high",
    "minEdge": 0.05,
    "maxPositionSize": 0.20,
    "maxDailyTrades": 10
  }}
}}

If the user's description is vague, make reasonable assumptions based on typical weather trading strategies. Always ensure the configuration is valid and executable.

Respond ONLY with the JSON object, no additional text."""


MARKET_ANALYSIS_PROMPT = """You are an expert weather forecaster and trading analyst. Analyze the following weather prediction market and provide your probability assessment.

Market Details:
- Type: {market_type}
- Location: {location}
- Question: {question}
- Current Market Probability: {market_probability}%
- Resolution Time: {resolution_time}

Current Weather Data:
{weather_data}

Agent Strategy:
- Thesis: {strategy_thesis}
- Position Direction Preference: {position_direction}

Historical Context:
{historical_context}

Analyze this market and provide your assessment. Consider:
1. Current weather conditions and trends
2. Historical patterns for this location and time of year
3. Forecast model uncertainty
4. Any edge between market price and true probability

Respond with a JSON object:
{{
  "predictedProbability": 0.XX,
  "confidence": "low|medium|high|very_high",
  "reasoning": "2-3 sentence explanation of your analysis",
  "weatherFactors": ["key", "weather", "factors"],
  "recommendedDirection": "YES|NO",
  "recommendedSizeMultiplier": 1.0
}}

Respond ONLY with the JSON object, no additional text."""


class BedrockClient:
    """Client for Amazon Bedrock Claude model."""

    def __init__(
        self,
        model_id: str | None = None,
        region: str | None = None,
    ) -> None:
        """Initialize Bedrock client.

        Args:
            model_id: Bedrock model ID (defaults to env var BEDROCK_MODEL_ID)
            region: AWS region (defaults to env var AWS_REGION)
        """
        self.model_id = model_id or os.environ.get(
            "BEDROCK_MODEL_ID",
            "anthropic.claude-3-5-sonnet-20241022-v2:0",
        )
        self.region = region or os.environ.get("AWS_REGION", "us-east-1")
        self._client = boto3.client("bedrock-runtime", region_name=self.region)
        logger.info(
            "bedrock_client_initialized",
            model_id=self.model_id,
            region=self.region,
        )

    def _invoke_model(self, prompt: str, max_tokens: int = 2048) -> str:
        """Invoke Bedrock model with prompt.

        Args:
            prompt: The prompt to send to the model
            max_tokens: Maximum tokens in response

        Returns:
            Model response text
        """
        body = json.dumps(
            {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": max_tokens,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
            }
        )

        response = self._client.invoke_model(
            modelId=self.model_id,
            body=body,
            contentType="application/json",
            accept="application/json",
        )

        response_body = json.loads(response["body"].read())
        return response_body["content"][0]["text"]

    def synthesize_strategy(self, user_input: str) -> SynthesizedStrategy:
        """Synthesize trading strategy from natural language description.

        Args:
            user_input: User's natural language strategy description

        Returns:
            Synthesized trading strategy
        """
        logger.info("synthesizing_strategy", input_length=len(user_input))

        prompt = STRATEGY_SYNTHESIS_PROMPT.format(user_input=user_input)
        response = self._invoke_model(prompt)

        try:
            # Parse JSON from response
            strategy_dict = json.loads(response.strip())
            strategy = SynthesizedStrategy.from_dict(strategy_dict, response)

            logger.info(
                "strategy_synthesized",
                strategy_name=strategy.strategy_name,
                market_types=strategy.market_selection.types,
                locations=strategy.market_selection.locations,
            )

            return strategy

        except json.JSONDecodeError as e:
            logger.error("strategy_parse_error", error=str(e), response=response)
            raise ValueError(f"Failed to parse strategy response: {e}") from e

    def analyze_market(
        self,
        market_id: str,
        market_type: str,
        location: str,
        question: str,
        market_probability: float,
        resolution_time: str,
        weather_data: dict[str, Any],
        strategy_thesis: str,
        position_direction: str,
        historical_context: str = "",
    ) -> MarketPrediction:
        """Analyze a market and provide prediction.

        Args:
            market_id: Market identifier
            market_type: Type of weather market
            location: Location code
            question: Market question
            market_probability: Current market probability (0-100)
            resolution_time: When market resolves
            weather_data: Current weather conditions
            strategy_thesis: Agent's trading thesis
            position_direction: Agent's directional preference
            historical_context: Optional historical data

        Returns:
            Market prediction with reasoning
        """
        logger.info(
            "analyzing_market",
            market_id=market_id,
            market_type=market_type,
            location=location,
        )

        weather_str = json.dumps(weather_data, indent=2)

        prompt = MARKET_ANALYSIS_PROMPT.format(
            market_type=market_type,
            location=location,
            question=question,
            market_probability=market_probability,
            resolution_time=resolution_time,
            weather_data=weather_str,
            strategy_thesis=strategy_thesis,
            position_direction=position_direction,
            historical_context=historical_context or "No historical context available.",
        )

        response = self._invoke_model(prompt)

        try:
            analysis = json.loads(response.strip())

            edge = abs(analysis["predictedProbability"] - (market_probability / 100))
            recommended_direction = PositionDirection(analysis["recommendedDirection"])

            prediction = MarketPrediction(
                market_id=market_id,
                predicted_probability=analysis["predictedProbability"],
                confidence=ConfidenceLevel(analysis["confidence"]),
                edge=edge,
                reasoning=analysis["reasoning"],
                weather_factors=analysis["weatherFactors"],
                recommended_direction=recommended_direction,
                recommended_size=analysis.get("recommendedSizeMultiplier", 1.0),
            )

            logger.info(
                "market_analyzed",
                market_id=market_id,
                predicted_probability=prediction.predicted_probability,
                confidence=prediction.confidence.value,
                edge=prediction.edge,
            )

            return prediction

        except (json.JSONDecodeError, KeyError) as e:
            logger.error("market_analysis_error", error=str(e), response=response)
            raise ValueError(f"Failed to parse market analysis: {e}") from e

    def explain_prediction(
        self,
        prediction: MarketPrediction,
        market_question: str,
    ) -> str:
        """Generate human-readable explanation of a prediction.

        Args:
            prediction: The market prediction to explain
            market_question: The market question for context

        Returns:
            Human-readable explanation
        """
        prompt = f"""Explain this weather market prediction in a conversational way for a Telegram user:

Market: {market_question}
My Prediction: {prediction.predicted_probability * 100:.1f}% probability
Confidence: {prediction.confidence.value}
Key Factors: {', '.join(prediction.weather_factors)}
Technical Analysis: {prediction.reasoning}

Write a 2-3 sentence explanation that's easy to understand. Be specific about the weather conditions driving this prediction. Don't use any JSON formatting."""

        return self._invoke_model(prompt, max_tokens=512)
