"""Strategy synthesizer Lambda handler using Amazon Bedrock."""

from __future__ import annotations

import json
from typing import Any

import structlog

from common.bedrock import BedrockClient

logger = structlog.get_logger()

# Cached client
_bedrock: BedrockClient | None = None


def get_bedrock() -> BedrockClient:
    """Get Bedrock client."""
    global _bedrock
    if _bedrock is None:
        _bedrock = BedrockClient()
    return _bedrock


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Synthesize trading strategy from natural language.

    This Lambda is invoked either directly or via Step Functions
    to synthesize user strategy descriptions into executable configs.

    Args:
        event: Event containing:
            - userInput: Natural language strategy description
            - action: Optional action type (synthesize, analyze, explain)
            - marketData: Optional market data for analysis
        context: Lambda context

    Returns:
        Synthesized strategy or analysis result
    """
    try:
        action = event.get("action", "synthesize")
        logger.info("strategy_synthesizer_invoked", action=action)

        bedrock = get_bedrock()

        if action == "synthesize":
            return handle_synthesize(bedrock, event)
        elif action == "analyze":
            return handle_analyze(bedrock, event)
        elif action == "explain":
            return handle_explain(bedrock, event)
        else:
            return {
                "statusCode": 400,
                "error": f"Unknown action: {action}",
            }

    except Exception as e:
        logger.exception("strategy_synthesizer_error", error=str(e))
        return {
            "statusCode": 500,
            "error": str(e),
        }


def handle_synthesize(bedrock: BedrockClient, event: dict[str, Any]) -> dict[str, Any]:
    """Handle strategy synthesis request.

    Args:
        bedrock: Bedrock client
        event: Event containing userInput

    Returns:
        Synthesized strategy
    """
    user_input = event.get("userInput", "")

    if not user_input:
        return {
            "statusCode": 400,
            "error": "userInput is required",
        }

    logger.info("synthesizing_strategy", input_length=len(user_input))

    strategy = bedrock.synthesize_strategy(user_input)

    return {
        "statusCode": 200,
        "strategy": strategy.to_dict(),
        "rawResponse": strategy.raw_response,
    }


def handle_analyze(bedrock: BedrockClient, event: dict[str, Any]) -> dict[str, Any]:
    """Handle market analysis request.

    Args:
        bedrock: Bedrock client
        event: Event containing market data and strategy

    Returns:
        Market analysis and prediction
    """
    market_data = event.get("marketData", {})
    strategy = event.get("strategy", {})

    required_fields = ["marketId", "marketType", "location", "question", "marketProbability"]
    missing = [f for f in required_fields if f not in market_data]

    if missing:
        return {
            "statusCode": 400,
            "error": f"Missing required market fields: {missing}",
        }

    logger.info(
        "analyzing_market",
        market_id=market_data.get("marketId"),
        market_type=market_data.get("marketType"),
    )

    prediction = bedrock.analyze_market(
        market_id=market_data["marketId"],
        market_type=market_data["marketType"],
        location=market_data["location"],
        question=market_data["question"],
        market_probability=market_data["marketProbability"],
        resolution_time=market_data.get("resolutionTime", ""),
        weather_data=market_data.get("weatherData", {}),
        strategy_thesis=strategy.get("thesis", ""),
        position_direction=strategy.get("positionDirection", "dynamic"),
        historical_context=market_data.get("historicalContext", ""),
    )

    return {
        "statusCode": 200,
        "prediction": {
            "marketId": prediction.market_id,
            "predictedProbability": prediction.predicted_probability,
            "confidence": prediction.confidence.value,
            "edge": prediction.edge,
            "reasoning": prediction.reasoning,
            "weatherFactors": prediction.weather_factors,
            "recommendedDirection": prediction.recommended_direction.value,
            "recommendedSize": prediction.recommended_size,
        },
    }


def handle_explain(bedrock: BedrockClient, event: dict[str, Any]) -> dict[str, Any]:
    """Handle prediction explanation request.

    Args:
        bedrock: Bedrock client
        event: Event containing prediction data

    Returns:
        Human-readable explanation
    """
    prediction_data = event.get("prediction", {})
    market_question = event.get("marketQuestion", "")

    if not prediction_data:
        return {
            "statusCode": 400,
            "error": "prediction is required",
        }

    logger.info("explaining_prediction", market_id=prediction_data.get("marketId"))

    from common.bedrock import ConfidenceLevel, MarketPrediction, PositionDirection

    prediction = MarketPrediction(
        market_id=prediction_data.get("marketId", ""),
        predicted_probability=prediction_data.get("predictedProbability", 0.5),
        confidence=ConfidenceLevel(prediction_data.get("confidence", "medium")),
        edge=prediction_data.get("edge", 0),
        reasoning=prediction_data.get("reasoning", ""),
        weather_factors=prediction_data.get("weatherFactors", []),
        recommended_direction=PositionDirection(
            prediction_data.get("recommendedDirection", "YES")
        ),
        recommended_size=prediction_data.get("recommendedSize", 1.0),
    )

    explanation = bedrock.explain_prediction(prediction, market_question)

    return {
        "statusCode": 200,
        "explanation": explanation,
    }


# Step Functions integration entry point
def step_function_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Entry point for Step Functions invocations.

    Wraps the main handler with additional state management for Step Functions.

    Args:
        event: Step Functions task input
        context: Lambda context

    Returns:
        Task output for Step Functions
    """
    result = lambda_handler(event, context)

    # Add execution metadata for Step Functions
    result["executionArn"] = event.get("executionArn", "")
    result["taskToken"] = event.get("taskToken", "")

    return result
