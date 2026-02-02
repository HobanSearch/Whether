"""Telegram Bot API client for Whether Agents."""

from __future__ import annotations

import os
from dataclasses import dataclass
from enum import Enum
from typing import Any

import httpx
import structlog

logger = structlog.get_logger()


class ParseMode(str, Enum):
    """Message parse modes."""

    MARKDOWN = "Markdown"
    MARKDOWN_V2 = "MarkdownV2"
    HTML = "HTML"


@dataclass
class TelegramUser:
    """Telegram user information."""

    id: int
    is_bot: bool
    first_name: str
    last_name: str | None = None
    username: str | None = None
    language_code: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TelegramUser:
        """Create from API response dict."""
        return cls(
            id=data["id"],
            is_bot=data["is_bot"],
            first_name=data["first_name"],
            last_name=data.get("last_name"),
            username=data.get("username"),
            language_code=data.get("language_code"),
        )


@dataclass
class TelegramMessage:
    """Telegram message information."""

    message_id: int
    chat_id: int
    from_user: TelegramUser | None
    text: str | None
    date: int
    reply_to_message: TelegramMessage | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TelegramMessage:
        """Create from API response dict."""
        from_user = None
        if "from" in data:
            from_user = TelegramUser.from_dict(data["from"])

        reply_to = None
        if "reply_to_message" in data:
            reply_to = cls.from_dict(data["reply_to_message"])

        return cls(
            message_id=data["message_id"],
            chat_id=data["chat"]["id"],
            from_user=from_user,
            text=data.get("text"),
            date=data["date"],
            reply_to_message=reply_to,
        )


@dataclass
class CallbackQuery:
    """Telegram callback query from inline keyboard."""

    id: str
    from_user: TelegramUser
    message: TelegramMessage | None
    chat_instance: str
    data: str | None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> CallbackQuery:
        """Create from API response dict."""
        message = None
        if "message" in data:
            message = TelegramMessage.from_dict(data["message"])

        return cls(
            id=data["id"],
            from_user=TelegramUser.from_dict(data["from"]),
            message=message,
            chat_instance=data["chat_instance"],
            data=data.get("data"),
        )


@dataclass
class InlineKeyboardButton:
    """Inline keyboard button."""

    text: str
    callback_data: str | None = None
    url: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to API format."""
        result: dict[str, Any] = {"text": self.text}
        if self.callback_data:
            result["callback_data"] = self.callback_data
        if self.url:
            result["url"] = self.url
        return result


@dataclass
class InlineKeyboardMarkup:
    """Inline keyboard markup."""

    inline_keyboard: list[list[InlineKeyboardButton]]

    def to_dict(self) -> dict[str, Any]:
        """Convert to API format."""
        return {
            "inline_keyboard": [
                [button.to_dict() for button in row]
                for row in self.inline_keyboard
            ]
        }


class TelegramBot:
    """Telegram Bot API client."""

    BASE_URL = "https://api.telegram.org"

    def __init__(self, token: str | None = None) -> None:
        """Initialize Telegram bot.

        Args:
            token: Bot API token (defaults to env var TELEGRAM_BOT_TOKEN)
        """
        self.token = token or os.environ.get("TELEGRAM_BOT_TOKEN", "")
        self._client = httpx.Client(timeout=30.0)
        logger.info("telegram_bot_initialized")

    def _api_url(self, method: str) -> str:
        """Build API URL for method."""
        return f"{self.BASE_URL}/bot{self.token}/{method}"

    def _request(self, method: str, **kwargs: Any) -> dict[str, Any]:
        """Make API request."""
        url = self._api_url(method)
        response = self._client.post(url, json=kwargs)
        response.raise_for_status()
        result = response.json()

        if not result.get("ok"):
            logger.error(
                "telegram_api_error",
                method=method,
                error=result.get("description"),
            )
            raise RuntimeError(f"Telegram API error: {result.get('description')}")

        return result.get("result", {})

    def send_message(
        self,
        chat_id: int,
        text: str,
        parse_mode: ParseMode | None = None,
        reply_markup: InlineKeyboardMarkup | None = None,
        reply_to_message_id: int | None = None,
        disable_web_page_preview: bool = True,
    ) -> TelegramMessage:
        """Send a text message.

        Args:
            chat_id: Target chat ID
            text: Message text
            parse_mode: Parse mode for formatting
            reply_markup: Inline keyboard markup
            reply_to_message_id: Message to reply to
            disable_web_page_preview: Disable link previews

        Returns:
            Sent message
        """
        params: dict[str, Any] = {
            "chat_id": chat_id,
            "text": text,
            "disable_web_page_preview": disable_web_page_preview,
        }

        if parse_mode:
            params["parse_mode"] = parse_mode.value
        if reply_markup:
            params["reply_markup"] = reply_markup.to_dict()
        if reply_to_message_id:
            params["reply_to_message_id"] = reply_to_message_id

        result = self._request("sendMessage", **params)
        logger.info("message_sent", chat_id=chat_id, message_id=result.get("message_id"))
        return TelegramMessage.from_dict(result)

    def edit_message_text(
        self,
        chat_id: int,
        message_id: int,
        text: str,
        parse_mode: ParseMode | None = None,
        reply_markup: InlineKeyboardMarkup | None = None,
    ) -> TelegramMessage:
        """Edit message text.

        Args:
            chat_id: Chat containing the message
            message_id: Message to edit
            text: New text
            parse_mode: Parse mode for formatting
            reply_markup: Updated inline keyboard

        Returns:
            Edited message
        """
        params: dict[str, Any] = {
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text,
        }

        if parse_mode:
            params["parse_mode"] = parse_mode.value
        if reply_markup:
            params["reply_markup"] = reply_markup.to_dict()

        result = self._request("editMessageText", **params)
        logger.info("message_edited", chat_id=chat_id, message_id=message_id)
        return TelegramMessage.from_dict(result)

    def answer_callback_query(
        self,
        callback_query_id: str,
        text: str | None = None,
        show_alert: bool = False,
    ) -> bool:
        """Answer callback query.

        Args:
            callback_query_id: Callback query ID to answer
            text: Optional notification text
            show_alert: Show as alert instead of notification

        Returns:
            Success status
        """
        params: dict[str, Any] = {
            "callback_query_id": callback_query_id,
            "show_alert": show_alert,
        }
        if text:
            params["text"] = text

        self._request("answerCallbackQuery", **params)
        logger.info("callback_answered", query_id=callback_query_id)
        return True

    def delete_message(self, chat_id: int, message_id: int) -> bool:
        """Delete a message.

        Args:
            chat_id: Chat containing the message
            message_id: Message to delete

        Returns:
            Success status
        """
        self._request("deleteMessage", chat_id=chat_id, message_id=message_id)
        logger.info("message_deleted", chat_id=chat_id, message_id=message_id)
        return True

    def set_webhook(self, url: str, secret_token: str | None = None) -> bool:
        """Set webhook URL.

        Args:
            url: Webhook URL
            secret_token: Secret token for webhook verification

        Returns:
            Success status
        """
        params: dict[str, Any] = {"url": url}
        if secret_token:
            params["secret_token"] = secret_token

        self._request("setWebhook", **params)
        logger.info("webhook_set", url=url)
        return True

    def get_webhook_info(self) -> dict[str, Any]:
        """Get current webhook info."""
        return self._request("getWebhookInfo")


# ==============================================================================
# MESSAGE TEMPLATES
# ==============================================================================

WELCOME_MESSAGE = """Welcome to Whether Agent Bot!

I help you create AI-powered trading agents for weather prediction markets on the TON blockchain.

*How it works:*
1. Describe your trading strategy in plain English
2. I'll synthesize it into executable trading logic
3. Your agent will autonomously trade on Whether markets

*Commands:*
/start - Start creating an agent
/status - Check your agent's performance
/explain - Get detailed reasoning for predictions
/markets - View available markets
/pause - Pause your agent
/resume - Resume your agent

Ready to create your agent? Just describe your weather trading strategy!

For example:
"I want to bet on temperature highs in NYC when forecasts show extreme heat in summer months"
"""

STRATEGY_SYNTHESIZED_MESSAGE = """Strategy synthesized!

*{strategy_name}*

*Thesis:*
{thesis}

*Markets:*
- Types: {market_types}
- Locations: {locations}
- Horizon: {time_horizon}

*Entry Conditions:*
{entry_conditions}

*Position Sizing:*
- Base: {base_size}%
- Scaling: {scaling_rule}

*Risk Controls:*
- Min Confidence: {min_confidence}
- Min Edge: {min_edge}%
- Max Position: {max_position}%
"""

AGENT_STATUS_MESSAGE = """Agent Status: *{status}*

*{strategy_name}*

*Performance:*
- Total Trades: {total_trades}
- Win Rate: {win_rate}%
- Total P&L: {total_pnl} TON
- Rank: #{rank}

*Recent Activity:*
{recent_activity}
"""

PREDICTION_EXPLANATION_MESSAGE = """*Market:* {market_question}

*My Analysis:*
{reasoning}

*Prediction:* {predicted_probability}% (Market: {market_probability}%)
*Edge:* {edge}%
*Confidence:* {confidence}

*Key Weather Factors:*
{weather_factors}

*Recommendation:* {direction} at {size}% position
"""


def format_strategy_message(strategy: dict[str, Any]) -> str:
    """Format synthesized strategy for display."""
    entry_conditions = "\n".join(
        f"  - {c['field']} {c['operator']} {c['value']}"
        for c in strategy.get("entryConditions", [])
    )

    return STRATEGY_SYNTHESIZED_MESSAGE.format(
        strategy_name=strategy.get("strategyName", "Unnamed Strategy"),
        thesis=strategy.get("thesis", ""),
        market_types=", ".join(strategy.get("marketSelection", {}).get("types", [])),
        locations=", ".join(strategy.get("marketSelection", {}).get("locations", [])),
        time_horizon=", ".join(strategy.get("marketSelection", {}).get("timeHorizon", [])),
        entry_conditions=entry_conditions or "  - None specified",
        base_size=strategy.get("positionSizing", {}).get("baseSize", 0.05) * 100,
        scaling_rule=strategy.get("positionSizing", {}).get("scalingRule", "fixed"),
        min_confidence=strategy.get("riskControls", {}).get("minConfidence", "medium"),
        min_edge=strategy.get("riskControls", {}).get("minEdge", 0.05) * 100,
        max_position=strategy.get("riskControls", {}).get("maxPositionSize", 0.20) * 100,
    )


def create_strategy_confirmation_keyboard() -> InlineKeyboardMarkup:
    """Create keyboard for strategy confirmation."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="Deploy Agent", callback_data="strategy:confirm"),
                InlineKeyboardButton(text="Adjust", callback_data="strategy:adjust"),
            ],
            [
                InlineKeyboardButton(text="Cancel", callback_data="strategy:cancel"),
            ],
        ]
    )


def create_agent_control_keyboard(agent_id: str, is_paused: bool) -> InlineKeyboardMarkup:
    """Create keyboard for agent control."""
    pause_resume = InlineKeyboardButton(
        text="Resume" if is_paused else "Pause",
        callback_data=f"agent:{'resume' if is_paused else 'pause'}:{agent_id}",
    )
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="View Details", callback_data=f"agent:details:{agent_id}"),
                pause_resume,
            ],
            [
                InlineKeyboardButton(text="View Predictions", callback_data=f"agent:predictions:{agent_id}"),
            ],
        ]
    )


def create_market_keyboard(markets: list[dict[str, Any]]) -> InlineKeyboardMarkup:
    """Create keyboard for market selection."""
    buttons = []
    for market in markets[:8]:  # Limit to 8 markets
        buttons.append([
            InlineKeyboardButton(
                text=f"{market.get('location', '')} - {market.get('type', '')}",
                callback_data=f"market:explain:{market.get('id', '')}",
            )
        ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)
