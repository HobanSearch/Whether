"""Telegram bot webhook Lambda handler for Whether Agents."""

from __future__ import annotations

import json
import os
from typing import Any

import boto3
import structlog

from common.bedrock import BedrockClient
from common.dynamodb import Agent, AgentStatus, DynamoDBClient
from common.telegram import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    ParseMode,
    TelegramBot,
    TelegramMessage,
    WELCOME_MESSAGE,
    create_agent_control_keyboard,
    create_market_keyboard,
    create_strategy_confirmation_keyboard,
    format_strategy_message,
)
from common.whether_api import WhetherAPIClient

logger = structlog.get_logger()

# Environment variables
SECRETS_ARN = os.environ.get("SECRETS_ARN", "")
STATE_MACHINE_ARN = os.environ.get("STATE_MACHINE_ARN", "")

# Cached clients
_secrets_client = None
_bot = None
_db = None
_whether_api = None
_bedrock = None


def get_secrets() -> dict[str, str]:
    """Get secrets from Secrets Manager."""
    global _secrets_client
    if _secrets_client is None:
        _secrets_client = boto3.client("secretsmanager")

    response = _secrets_client.get_secret_value(SecretId=SECRETS_ARN)
    return json.loads(response["SecretString"])


def get_bot() -> TelegramBot:
    """Get Telegram bot client."""
    global _bot
    if _bot is None:
        secrets = get_secrets()
        _bot = TelegramBot(token=secrets["telegram_bot_token"])
    return _bot


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


def get_bedrock() -> BedrockClient:
    """Get Bedrock client."""
    global _bedrock
    if _bedrock is None:
        _bedrock = BedrockClient()
    return _bedrock


# User state for conversation flow (in production, use DynamoDB)
_user_state: dict[int, dict[str, Any]] = {}


def get_user_state(chat_id: int) -> dict[str, Any]:
    """Get user conversation state."""
    return _user_state.get(chat_id, {})


def set_user_state(chat_id: int, state: dict[str, Any]) -> None:
    """Set user conversation state."""
    _user_state[chat_id] = state


def clear_user_state(chat_id: int) -> None:
    """Clear user conversation state."""
    _user_state.pop(chat_id, None)


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Handle Telegram webhook events.

    Args:
        event: API Gateway event with Telegram update
        context: Lambda context

    Returns:
        API Gateway response
    """
    try:
        body = json.loads(event.get("body", "{}"))
        logger.info("webhook_received", update_id=body.get("update_id"))

        # Handle message or callback query
        if "message" in body:
            message = TelegramMessage.from_dict(body["message"])
            handle_message(message)
        elif "callback_query" in body:
            callback = CallbackQuery.from_dict(body["callback_query"])
            handle_callback(callback)

        return {"statusCode": 200, "body": "OK"}

    except Exception as e:
        logger.exception("webhook_error", error=str(e))
        return {"statusCode": 200, "body": "OK"}  # Always return 200 to prevent retries


def handle_message(message: TelegramMessage) -> None:
    """Handle incoming message.

    Args:
        message: Telegram message
    """
    if not message.text:
        return

    text = message.text.strip()
    chat_id = message.chat_id
    user_id = str(message.from_user.id) if message.from_user else str(chat_id)

    logger.info(
        "message_received",
        chat_id=chat_id,
        user_id=user_id,
        text_preview=text[:50],
    )

    # Command handlers
    if text.startswith("/"):
        command = text.split()[0].lower()
        args = text[len(command):].strip()

        if command == "/start":
            handle_start_command(chat_id, user_id)
        elif command == "/status":
            handle_status_command(chat_id, user_id)
        elif command == "/explain":
            handle_explain_command(chat_id, user_id, args)
        elif command == "/markets":
            handle_markets_command(chat_id, user_id)
        elif command == "/pause":
            handle_pause_command(chat_id, user_id)
        elif command == "/resume":
            handle_resume_command(chat_id, user_id)
        elif command == "/help":
            handle_help_command(chat_id)
        else:
            get_bot().send_message(
                chat_id,
                "Unknown command. Use /help to see available commands.",
            )
    else:
        # Natural language - process as strategy description
        handle_strategy_input(chat_id, user_id, text)


def handle_callback(callback: CallbackQuery) -> None:
    """Handle callback query from inline keyboard.

    Args:
        callback: Callback query
    """
    bot = get_bot()

    if not callback.data:
        bot.answer_callback_query(callback.id)
        return

    chat_id = callback.message.chat_id if callback.message else 0
    user_id = str(callback.from_user.id)

    logger.info(
        "callback_received",
        chat_id=chat_id,
        user_id=user_id,
        data=callback.data,
    )

    parts = callback.data.split(":")
    action_type = parts[0]
    action = parts[1] if len(parts) > 1 else ""
    action_id = parts[2] if len(parts) > 2 else ""

    if action_type == "strategy":
        handle_strategy_callback(callback, chat_id, user_id, action)
    elif action_type == "agent":
        handle_agent_callback(callback, chat_id, user_id, action, action_id)
    elif action_type == "market":
        handle_market_callback(callback, chat_id, user_id, action, action_id)

    bot.answer_callback_query(callback.id)


# =============================================================================
# COMMAND HANDLERS
# =============================================================================


def handle_start_command(chat_id: int, user_id: str) -> None:
    """Handle /start command."""
    bot = get_bot()

    # Check for existing agents
    db = get_db()
    agents = db.get_agents_by_user(user_id)

    if agents:
        # Show existing agents
        active_agents = [a for a in agents if a.status == AgentStatus.ACTIVE]
        message = f"Welcome back! You have {len(agents)} agent(s).\n\n"

        if active_agents:
            message += "Active Agents:\n"
            for agent in active_agents[:5]:
                message += f"- {agent.strategy_name} (Win rate: {agent.win_rate * 100:.1f}%)\n"

        message += "\nDescribe a new strategy or use /status to check your agents."

        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="View All Agents", callback_data="agent:list:all")],
                [InlineKeyboardButton(text="Create New Agent", callback_data="strategy:new")],
            ]
        )

        bot.send_message(chat_id, message, reply_markup=keyboard)
    else:
        # New user - show welcome message
        bot.send_message(chat_id, WELCOME_MESSAGE, parse_mode=ParseMode.MARKDOWN)


def handle_status_command(chat_id: int, user_id: str) -> None:
    """Handle /status command."""
    bot = get_bot()
    db = get_db()

    agents = db.get_agents_by_user(user_id)

    if not agents:
        bot.send_message(
            chat_id,
            "You don't have any agents yet. Describe your trading strategy to create one!",
        )
        return

    # Get the most active agent or most recent
    agent = max(agents, key=lambda a: (a.status == AgentStatus.ACTIVE, a.updated_at))

    # Get recent predictions
    predictions = db.get_predictions_by_agent(agent.agent_id, limit=5)
    recent_activity = ""
    for pred in predictions[:3]:
        recent_activity += f"- {pred.market_id[:8]}... {pred.recommended_direction} ({pred.confidence})\n"

    if not recent_activity:
        recent_activity = "No recent predictions"

    # Get rank
    rank = db.get_agent_rank(agent.agent_id) or 0

    message = f"""Agent Status: *{agent.status.value.upper()}*

*{agent.strategy_name}*

*Performance:*
- Total Trades: {agent.total_trades}
- Win Rate: {agent.win_rate * 100:.1f}%
- Total P&L: {agent.total_pnl} TON
- Rank: #{rank if rank else 'Unranked'}

*Recent Activity:*
{recent_activity}
"""

    keyboard = create_agent_control_keyboard(agent.agent_id, agent.status == AgentStatus.PAUSED)
    bot.send_message(chat_id, message, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)


def handle_explain_command(chat_id: int, user_id: str, args: str) -> None:
    """Handle /explain command."""
    bot = get_bot()
    db = get_db()

    agents = db.get_agents_by_user(user_id)
    if not agents:
        bot.send_message(chat_id, "You don't have any agents. Create one first!")
        return

    # Get the active agent
    active_agents = [a for a in agents if a.status == AgentStatus.ACTIVE]
    if not active_agents:
        bot.send_message(chat_id, "No active agents. Use /resume to activate an agent.")
        return

    agent = active_agents[0]

    if args:
        # Explain specific market
        market_id = args.strip()
        prediction = db.get_prediction_for_market(agent.agent_id, market_id)

        if not prediction:
            bot.send_message(chat_id, f"No prediction found for market {market_id}")
            return

        # Get detailed explanation from Bedrock
        bedrock = get_bedrock()
        from common.bedrock import MarketPrediction, ConfidenceLevel, PositionDirection

        market_pred = MarketPrediction(
            market_id=prediction.market_id,
            predicted_probability=prediction.predicted_probability,
            confidence=ConfidenceLevel(prediction.confidence),
            edge=prediction.edge,
            reasoning=prediction.reasoning,
            weather_factors=prediction.weather_factors,
            recommended_direction=PositionDirection(prediction.recommended_direction),
            recommended_size=1.0,
        )

        explanation = bedrock.explain_prediction(market_pred, f"Market {market_id}")
        bot.send_message(chat_id, explanation)
    else:
        # Show recent predictions
        predictions = db.get_predictions_by_agent(agent.agent_id, limit=5)

        if not predictions:
            bot.send_message(chat_id, "No predictions yet. Wait for the next analysis cycle.")
            return

        message = "Recent Predictions:\n\n"
        for pred in predictions:
            correct_str = ""
            if pred.was_correct is not None:
                correct_str = " - CORRECT" if pred.was_correct else " - INCORRECT"
            message += f"*{pred.market_id[:12]}...*\n"
            message += f"  Predicted: {pred.predicted_probability * 100:.1f}% {pred.recommended_direction}\n"
            message += f"  Edge: {pred.edge * 100:.1f}% | Confidence: {pred.confidence}{correct_str}\n\n"

        message += "\nUse `/explain <market_id>` for detailed reasoning."
        bot.send_message(chat_id, message, parse_mode=ParseMode.MARKDOWN)


def handle_markets_command(chat_id: int, user_id: str) -> None:
    """Handle /markets command."""
    bot = get_bot()
    api = get_whether_api()

    try:
        markets = api.get_active_markets()

        if not markets:
            bot.send_message(chat_id, "No active markets at the moment.")
            return

        message = "Active Markets:\n\n"
        market_data = []

        for market in markets[:10]:
            message += f"*{market.location.value}* - {market.type.value}\n"
            message += f"  {market.question[:50]}...\n"
            message += f"  YES: {market.yes_probability:.1f}% | Resolves: {market.resolution_time.strftime('%m/%d %H:%M')}\n\n"
            market_data.append({
                "id": market.id,
                "location": market.location.value,
                "type": market.type.value,
            })

        keyboard = create_market_keyboard(market_data)
        bot.send_message(chat_id, message, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)

    except Exception as e:
        logger.exception("markets_fetch_error", error=str(e))
        bot.send_message(chat_id, "Error fetching markets. Please try again later.")


def handle_pause_command(chat_id: int, user_id: str) -> None:
    """Handle /pause command."""
    bot = get_bot()
    db = get_db()

    agents = db.get_agents_by_user(user_id)
    active = [a for a in agents if a.status == AgentStatus.ACTIVE]

    if not active:
        bot.send_message(chat_id, "No active agents to pause.")
        return

    agent = active[0]
    db.update_agent_status(agent.agent_id, AgentStatus.PAUSED)

    bot.send_message(
        chat_id,
        f"Agent '{agent.strategy_name}' has been paused. Use /resume to reactivate.",
    )


def handle_resume_command(chat_id: int, user_id: str) -> None:
    """Handle /resume command."""
    bot = get_bot()
    db = get_db()

    agents = db.get_agents_by_user(user_id)
    paused = [a for a in agents if a.status == AgentStatus.PAUSED]

    if not paused:
        bot.send_message(chat_id, "No paused agents to resume.")
        return

    agent = paused[0]
    db.update_agent_status(agent.agent_id, AgentStatus.ACTIVE)

    bot.send_message(
        chat_id,
        f"Agent '{agent.strategy_name}' is now active and will resume trading.",
    )


def handle_help_command(chat_id: int) -> None:
    """Handle /help command."""
    bot = get_bot()

    help_text = """*Whether Agent Bot - Commands*

/start - Create a new agent or view existing ones
/status - Check your agent's performance
/explain - Get detailed prediction reasoning
/markets - View available prediction markets
/pause - Pause your active agent
/resume - Resume a paused agent
/help - Show this help message

*Creating an Agent*
Simply describe your trading strategy in plain English:

"I want to bet against high temperature predictions in Miami during winter months"

"Trade YES on precipitation in Chicago when forecasts show rain likely"

"Conservative strategy: only trade high confidence temperature markets in NYC"

The AI will synthesize your description into an executable strategy.
"""

    bot.send_message(chat_id, help_text, parse_mode=ParseMode.MARKDOWN)


# =============================================================================
# STRATEGY HANDLERS
# =============================================================================


def handle_strategy_input(chat_id: int, user_id: str, text: str) -> None:
    """Handle natural language strategy description.

    Args:
        chat_id: Telegram chat ID
        user_id: User identifier
        text: Strategy description text
    """
    bot = get_bot()

    # Send "typing" indicator
    bot.send_message(chat_id, "Analyzing your strategy...")

    try:
        bedrock = get_bedrock()
        strategy = bedrock.synthesize_strategy(text)

        # Store strategy in user state
        set_user_state(chat_id, {
            "pending_strategy": strategy.to_dict(),
            "raw_input": text,
        })

        # Format and send strategy confirmation
        message = format_strategy_message(strategy.to_dict())
        keyboard = create_strategy_confirmation_keyboard()

        bot.send_message(
            chat_id,
            message,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=keyboard,
        )

    except Exception as e:
        logger.exception("strategy_synthesis_error", error=str(e))
        bot.send_message(
            chat_id,
            "I couldn't understand that strategy. Please try describing it differently.\n\n"
            "Example: 'Bet on high temperatures in NYC when forecasts predict heat waves'",
        )


def handle_strategy_callback(
    callback: CallbackQuery,
    chat_id: int,
    user_id: str,
    action: str,
) -> None:
    """Handle strategy-related callbacks."""
    bot = get_bot()
    db = get_db()

    state = get_user_state(chat_id)

    if action == "confirm":
        strategy_config = state.get("pending_strategy")
        if not strategy_config:
            bot.send_message(chat_id, "No pending strategy. Please describe a new one.")
            return

        # Create the agent
        agent = Agent.create(
            user_id=user_id,
            telegram_chat_id=chat_id,
            strategy_name=strategy_config.get("strategyName", "Unnamed Strategy"),
            strategy_config=strategy_config,
        )
        agent.status = AgentStatus.ACTIVE
        db.create_agent(agent)

        # Clear state
        clear_user_state(chat_id)

        # Update the message
        if callback.message:
            bot.edit_message_text(
                chat_id=chat_id,
                message_id=callback.message.message_id,
                text=f"Agent '{agent.strategy_name}' deployed successfully!\n\n"
                f"Agent ID: `{agent.agent_id[:8]}...`\n\n"
                f"Your agent will start analyzing markets in the next cycle (every 15 minutes).\n"
                f"Use /status to check its performance.",
                parse_mode=ParseMode.MARKDOWN,
            )

    elif action == "adjust":
        bot.send_message(
            chat_id,
            "Please describe what you'd like to change about the strategy:",
        )

    elif action == "cancel":
        clear_user_state(chat_id)
        if callback.message:
            bot.delete_message(chat_id, callback.message.message_id)
        bot.send_message(chat_id, "Strategy cancelled. Describe a new one when ready!")

    elif action == "new":
        clear_user_state(chat_id)
        bot.send_message(
            chat_id,
            "Describe your new trading strategy. For example:\n\n"
            "'Bet on high temperatures in NYC when forecasts are above 90F'",
        )


# =============================================================================
# AGENT HANDLERS
# =============================================================================


def handle_agent_callback(
    callback: CallbackQuery,
    chat_id: int,
    user_id: str,
    action: str,
    agent_id: str,
) -> None:
    """Handle agent-related callbacks."""
    bot = get_bot()
    db = get_db()

    if action == "list":
        agents = db.get_agents_by_user(user_id)

        if not agents:
            bot.send_message(chat_id, "No agents found.")
            return

        message = "Your Agents:\n\n"
        buttons = []

        for agent in agents:
            status_emoji = {
                AgentStatus.ACTIVE: "",
                AgentStatus.PAUSED: "[PAUSED]",
                AgentStatus.PENDING: "[PENDING]",
                AgentStatus.STOPPED: "[STOPPED]",
            }.get(agent.status, "")

            message += f"*{agent.strategy_name}* {status_emoji}\n"
            message += f"  Trades: {agent.total_trades} | Win: {agent.win_rate * 100:.1f}%\n\n"

            buttons.append([
                InlineKeyboardButton(
                    text=agent.strategy_name[:20],
                    callback_data=f"agent:details:{agent.agent_id}",
                )
            ])

        keyboard = InlineKeyboardMarkup(inline_keyboard=buttons)
        bot.send_message(chat_id, message, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)

    elif action == "details":
        agent = db.get_agent(agent_id)
        if not agent:
            bot.send_message(chat_id, "Agent not found.")
            return

        predictions = db.get_predictions_by_agent(agent_id, limit=5)
        positions = db.get_positions_by_agent(agent_id)

        message = f"""*{agent.strategy_name}*
Status: {agent.status.value.upper()}

*Strategy:*
{agent.strategy_config.get('thesis', 'No thesis defined')}

*Performance:*
- Total Trades: {agent.total_trades}
- Winning Trades: {agent.winning_trades}
- Win Rate: {agent.win_rate * 100:.1f}%
- Total P&L: {agent.total_pnl} TON

*Open Positions:* {len([p for p in positions if p.status.value == 'open'])}
*Recent Predictions:* {len(predictions)}
"""

        keyboard = create_agent_control_keyboard(agent_id, agent.status == AgentStatus.PAUSED)
        bot.send_message(chat_id, message, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)

    elif action == "pause":
        db.update_agent_status(agent_id, AgentStatus.PAUSED)
        bot.send_message(chat_id, "Agent paused. Use /resume to reactivate.")

    elif action == "resume":
        db.update_agent_status(agent_id, AgentStatus.ACTIVE)
        bot.send_message(chat_id, "Agent resumed and will continue trading.")

    elif action == "predictions":
        predictions = db.get_predictions_by_agent(agent_id, limit=10)

        if not predictions:
            bot.send_message(chat_id, "No predictions yet.")
            return

        message = "Recent Predictions:\n\n"
        for pred in predictions:
            status = ""
            if pred.was_correct is not None:
                status = " CORRECT" if pred.was_correct else " WRONG"
            message += f"Market: {pred.market_id[:12]}...\n"
            message += f"  {pred.recommended_direction} @ {pred.predicted_probability * 100:.1f}%{status}\n"
            message += f"  Edge: {pred.edge * 100:.1f}% | {pred.confidence}\n\n"

        bot.send_message(chat_id, message)


# =============================================================================
# MARKET HANDLERS
# =============================================================================


def handle_market_callback(
    callback: CallbackQuery,
    chat_id: int,
    user_id: str,
    action: str,
    market_id: str,
) -> None:
    """Handle market-related callbacks."""
    bot = get_bot()
    db = get_db()
    api = get_whether_api()

    if action == "explain":
        # Get agent's prediction for this market
        agents = db.get_agents_by_user(user_id)
        active = [a for a in agents if a.status == AgentStatus.ACTIVE]

        if not active:
            # Show market info without agent analysis
            try:
                market = api.get_market(market_id)
                message = f"""*{market.location.value} - {market.type.value}*

{market.question}

Current Price:
- YES: {market.yes_probability:.1f}%
- NO: {market.no_probability:.1f}%

Resolves: {market.resolution_time.strftime('%Y-%m-%d %H:%M UTC')}

Create an agent to get AI analysis of this market!
"""
                bot.send_message(chat_id, message, parse_mode=ParseMode.MARKDOWN)
            except Exception as e:
                logger.exception("market_fetch_error", error=str(e))
                bot.send_message(chat_id, "Error fetching market details.")
            return

        agent = active[0]
        prediction = db.get_prediction_for_market(agent.agent_id, market_id)

        if not prediction:
            bot.send_message(
                chat_id,
                "No prediction for this market yet. Wait for the next analysis cycle.",
            )
            return

        message = f"""*Market Analysis*

*Question:* {prediction.market_id}

*My Prediction:* {prediction.predicted_probability * 100:.1f}%
*Market Price:* {prediction.market_probability * 100:.1f}%
*Edge:* {prediction.edge * 100:.1f}%
*Confidence:* {prediction.confidence}

*Reasoning:*
{prediction.reasoning}

*Key Factors:*
{chr(10).join('- ' + f for f in prediction.weather_factors)}

*Recommendation:* {prediction.recommended_direction}
"""

        bot.send_message(chat_id, message, parse_mode=ParseMode.MARKDOWN)
