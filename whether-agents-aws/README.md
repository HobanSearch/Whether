# Whether Agents - AWS Infrastructure

AI-powered autonomous trading system for weather prediction markets on the Whether platform.

## Architecture

```
                                    ┌─────────────────┐
                                    │   Telegram Bot  │
                                    └────────┬────────┘
                                             │
                                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          API Gateway                                  │
│                         /webhook (POST)                               │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   Bot Webhook Lambda   │◄────┐
                    └────────────┬───────────┘     │
                                 │                 │
                    ┌────────────┴───────────┐     │
                    ▼                        ▼     │
        ┌───────────────────┐    ┌──────────────────────┐
        │ Strategy          │    │   Step Functions     │
        │ Synthesizer       │    │   (Confirmation)     │
        │ (Bedrock)         │    └──────────────────────┘
        └───────────────────┘

                    ┌────────────────────────┐
                    │  EventBridge (15 min)  │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  Agent Orchestrator    │
                    │  Lambda                │
                    └────────────┬───────────┘
                                 │
                    ┌────────────┴───────────┐
                    ▼                        ▼
        ┌───────────────────┐    ┌───────────────────┐
        │ Bedrock (Claude)  │    │   SQS Queue       │
        │ Market Analysis   │    │ (Position Exec)   │
        └───────────────────┘    └─────────┬─────────┘
                                           │
                                           ▼
                              ┌────────────────────────┐
                              │ Position Executor      │
                              │ Lambda (SQS Consumer)  │
                              └────────────────────────┘

                    ┌────────────────────────┐
                    │  EventBridge (Hourly)  │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │ Leaderboard Updater    │
                    │ Lambda                 │
                    └────────────────────────┘

                    ┌────────────────────────┐
                    │ EventBridge (Daily)    │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │ Market Resolver        │
                    │ Lambda                 │
                    └────────────────────────┘
```

## AWS Services Used

1. **Amazon Bedrock** - Claude 3.5 Sonnet for strategy synthesis and market analysis
2. **AWS Lambda** - 6 functions for different operations
3. **Amazon DynamoDB** - 4 tables for data storage
4. **Amazon EventBridge** - Scheduled triggers (15-min, hourly, daily)
5. **Amazon API Gateway** - Bot webhook endpoint
6. **Amazon SQS** - Position execution queue with DLQ
7. **AWS Step Functions** - Strategy confirmation workflow
8. **AWS Secrets Manager** - Secure credential storage
9. **Amazon CloudWatch** - Monitoring dashboard and logs
10. **Amazon S3** - SAM deployment artifacts

## Prerequisites

- AWS CLI configured with appropriate credentials
- AWS SAM CLI installed
- Python 3.11+
- Telegram Bot Token (from @BotFather)
- OpenWeatherMap API Key

## Deployment

### First-time setup

1. Enable Amazon Bedrock Claude 3.5 Sonnet in us-east-1:
   ```bash
   aws bedrock put-model-access-policy \
     --region us-east-1 \
     --model-id anthropic.claude-3-5-sonnet-20241022-v2:0 \
     --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*","Action":"bedrock:InvokeModel"}]}'
   ```

2. Build and deploy:
   ```bash
   sam build
   sam deploy --guided
   ```

3. Set Telegram webhook:
   ```bash
   WEBHOOK_URL=$(aws cloudformation describe-stacks \
     --stack-name whether-agents-dev \
     --query 'Stacks[0].Outputs[?OutputKey==`BotWebhookUrl`].OutputValue' \
     --output text)

   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d "{\"url\": \"$WEBHOOK_URL\"}"
   ```

### Subsequent deployments

```bash
sam build && sam deploy
```

### Deploy to different environments

```bash
# Staging
sam build && sam deploy --config-env staging

# Production
sam build && sam deploy --config-env prod
```

## Configuration

### Required Parameters

| Parameter | Description |
|-----------|-------------|
| `TelegramBotToken` | Bot API token from @BotFather |
| `OpenWeatherMapApiKey` | API key for weather data |
| `WhetherApiUrl` | Whether API base URL |

### Environment Variables

All Lambda functions share these environment variables:
- `AGENTS_TABLE` - DynamoDB agents table name
- `POSITIONS_TABLE` - DynamoDB positions table name
- `PREDICTIONS_TABLE` - DynamoDB predictions table name
- `LEADERBOARD_TABLE` - DynamoDB leaderboard table name
- `POSITION_QUEUE_URL` - SQS queue URL
- `WHETHER_API_URL` - Whether API endpoint

## DynamoDB Schema

### Agents Table
- **PK**: `AGENT#{agentId}`
- **SK**: `METADATA`
- **GSI1**: `USER#{userId}` / `AGENT#{createdAt}`

### Positions Table
- **PK**: `POSITION#{positionId}`
- **SK**: `METADATA`
- **GSI1**: `AGENT#{agentId}` / `POSITION#{createdAt}`
- TTL: 90 days

### Predictions Table
- **PK**: `PREDICTION#{predictionId}`
- **SK**: `METADATA`
- **GSI1**: `AGENT#{agentId}` / `PREDICTION#{createdAt}`
- TTL: 30 days

### Leaderboard Table
- **PK**: `LEADERBOARD#{period}`
- **SK**: `RANK#{rank}`
- **GSI1**: `AGENT#{agentId}` / `{score}`

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Create a new agent or view existing |
| `/status` | Check agent performance |
| `/explain [market]` | Get prediction reasoning |
| `/markets` | View active markets |
| `/pause` | Pause active agent |
| `/resume` | Resume paused agent |
| `/help` | Show help message |

## Strategy Configuration

Agents use JSON-based strategy configurations:

```json
{
  "strategyName": "Heat Wave Trader",
  "thesis": "Bet on high temperatures in NYC during summer",
  "marketSelection": {
    "types": ["temperature_high"],
    "locations": ["NYC"],
    "timeHorizon": ["same_day", "next_day"]
  },
  "entryConditions": [
    {"field": "edge", "operator": "gte", "value": 0.05},
    {"field": "confidence", "operator": "gte", "value": "medium"}
  ],
  "positionDirection": "YES",
  "positionSizing": {
    "baseSize": 0.05,
    "scalingRule": "confidence_scaled"
  },
  "riskControls": {
    "minConfidence": "medium",
    "minEdge": 0.05,
    "maxPositionSize": 0.20,
    "maxDailyTrades": 10
  }
}
```

## Monitoring

### CloudWatch Dashboard

Access at: `https://<region>.console.aws.amazon.com/cloudwatch/home#dashboards:name=whether-agents-<env>`

Metrics tracked:
- Lambda invocations and errors
- SQS queue depth
- DynamoDB throttled requests
- Step Functions executions

### Logs

View logs in CloudWatch Log Groups:
- `/aws/lambda/whether-bot-webhook-<env>`
- `/aws/lambda/whether-strategy-synthesizer-<env>`
- `/aws/lambda/whether-agent-orchestrator-<env>`
- `/aws/lambda/whether-position-executor-<env>`
- `/aws/lambda/whether-leaderboard-updater-<env>`
- `/aws/lambda/whether-market-resolver-<env>`

## Local Development

```bash
# Install dependencies
pip install -r src/layers/common/requirements.txt

# Run tests
pytest tests/

# Local invoke
sam local invoke BotWebhookFunction -e events/webhook.json
```

## Cleanup

```bash
sam delete --stack-name whether-agents-dev
```
