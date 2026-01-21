# ForexAI Trading Agent

An autonomous AI agent system for Forex trading assistance. The system uses an orchestrator-worker pattern to analyze market conditions and execute trades on broker platforms.

## Features

- **AI-Powered Analysis**: Uses Gemini 1.5 Pro for market analysis and decision making
- **Orchestrator Architecture**: Central coordinator manages specialized agents (Analyst, Executor)
- **Real-time Streaming**: Server-Sent Events (SSE) for streaming responses
- **Conversation History**: Maintains session-based conversation context
- **Docker Ready**: Production-ready containerization

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Orchestrator Agent                    │
│         (Routes tasks to specialized agents)            │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
┌───────────────┐           ┌───────────────┐
│ Analyst Agent │           │ Executor Agent│
│ (Market       │           │ (Browser      │
│  Analysis)    │           │  Automation)  │
└───────────────┘           └───────────────┘
```

## Prerequisites

- Node.js >= 20.0.0
- Yarn package manager
- Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))
- Docker (optional, for containerized deployment)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd forex-bot
yarn install
```

### 2. Configure Environment

Copy the example environment file and add your API key:

```bash
cp .env.example .env
```

Edit `.env` and set your Gemini API key:

```env
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
PORT=8090
```

### 3. Run the Application

**Development mode** (with hot reload):

```bash
yarn dev
```

**Production mode**:

```bash
yarn start
```

The server will start on `http://localhost:8090`.

## API Endpoints

### Health Check

```bash
GET /ping
```

Returns the health status of the agent system.

**cURL Example:**

```bash
curl http://localhost:8090/ping
```

**Response:**

```json
{
  "status": "Healthy",
  "timestamp": "2024-01-17T10:00:00.000Z",
  "details": {
    "toolsInitialized": true,
    "toolCount": 2,
    "analystAgentAvailable": true,
    "executorAgentAvailable": true
  }
}
```

### Chat / Invoke Agent

```bash
POST /invocations
Content-Type: application/json
```

**Request Body:**

```json
{
  "message": "Analyze the EUR/USD pair for potential entry points",
  "sessionId": "user-session-123"
}
```

**cURL Example:**

```bash
# Basic invocation (use -N to disable buffering for SSE)
curl -N -X POST http://localhost:8090/invocations \
  -H "Content-Type: application/json" \
  -d '{"message": "Analyze EUR/USD", "sessionId": "session-1"}'

# Ask for market analysis
curl -N -X POST http://localhost:8090/invocations \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the current trend for GBP/USD?", "sessionId": "session-1"}'

# Request trading recommendation
curl -N -X POST http://localhost:8090/invocations \
  -H "Content-Type: application/json" \
  -d '{"message": "Should I buy or sell USD/JPY based on current conditions?", "sessionId": "session-1"}'

# Continue conversation (same sessionId maintains context)
curl -N -X POST http://localhost:8090/invocations \
  -H "Content-Type: application/json" \
  -d '{"message": "What are the key support levels?", "sessionId": "session-1"}'
```

**Response:** Server-Sent Events (SSE) stream

```
data: {"type":"connected","message":"ForexAI Agent connected successfully"}

data: {"type":"step","content":"Analyzing market conditions..."}

data: {"type":"result","content":"**Market Analysis**\n\nBias: BULLISH\nConfidence: 75%..."}

data: {"type":"done"}
```

### Get Conversation History

```bash
GET /history?sessionId=user-session-123
```

**cURL Example:**

```bash
# Get history for a specific session
curl "http://localhost:8090/history?sessionId=session-1"

# Pretty print with jq
curl -s "http://localhost:8090/history?sessionId=session-1" | jq
```

**Response:**

```json
{
  "sessionId": "user-session-123",
  "history": [
    {
      "role": "user",
      "content": "Analyze EUR/USD",
      "timestamp": "2024-01-17T10:00:00.000Z"
    },
    {
      "role": "assistant",
      "content": "Based on my analysis...",
      "timestamp": "2024-01-17T10:00:05.000Z"
    }
  ],
  "count": 2
}
```

### Clear Conversation History

```bash
# Clear specific session
DELETE /history?sessionId=user-session-123

# Clear all sessions
DELETE /history
```

**cURL Example:**

```bash
# Clear history for a specific session
curl -X DELETE "http://localhost:8090/history?sessionId=session-1"

# Clear all conversation history
curl -X DELETE http://localhost:8090/history
```

**Response:**

```json
{
  "message": "Conversation history cleared for session session-1"
}
```

## Usage Examples

### Complete cURL Workflow

```bash
# 1. Check if the server is healthy
curl http://localhost:8090/ping

# 2. Start a new conversation session
curl -N -X POST http://localhost:8090/invocations \
  -H "Content-Type: application/json" \
  -d '{"message": "Analyze the EUR/USD pair", "sessionId": "trading-session-001"}'

# 3. Follow up question (maintains conversation context)
curl -N -X POST http://localhost:8090/invocations \
  -H "Content-Type: application/json" \
  -d '{"message": "What entry price would you recommend?", "sessionId": "trading-session-001"}'

# 4. Ask about risk management
curl -N -X POST http://localhost:8090/invocations \
  -H "Content-Type: application/json" \
  -d '{"message": "Where should I place my stop loss?", "sessionId": "trading-session-001"}'

# 5. Review the conversation history
curl -s "http://localhost:8090/history?sessionId=trading-session-001" | jq

# 6. Start a fresh session for a different pair
curl -N -X POST http://localhost:8090/invocations \
  -H "Content-Type: application/json" \
  -d '{"message": "What is your analysis for GBP/JPY?", "sessionId": "trading-session-002"}'

# 7. Clean up old session
curl -X DELETE "http://localhost:8090/history?sessionId=trading-session-001"
```

### Using JavaScript/TypeScript

```typescript
// Using fetch with SSE
const response = await fetch('http://localhost:8090/invocations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Analyze EUR/USD for entry signals',
    sessionId: 'my-session',
  }),
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader!.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      console.log(data.type, data.content);
    }
  }
}
```

## Docker Deployment

### Build and Run

```bash
# Build the image
docker build -t forex-bot .

# Run the container
docker run -d \
  --name forex-bot \
  -p 8090:8090 \
  -e GEMINI_API_KEY=your_api_key \
  -e OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/ \
  forex-bot
```

### Using Docker Compose

```bash
# Production
docker-compose up -d

# Development (with hot reload)
docker-compose --profile dev up forex-bot-dev

# View logs
docker-compose logs -f forex-bot

# Stop
docker-compose down
```

## Project Structure

```
forex-bot/
├── src/
│   ├── main.ts                 # Express server entry point
│   └── agents/
│       ├── index.ts            # Agent exports
│       ├── orchestrator.agent.ts   # Central coordinator
│       ├── analyst.agent.ts    # Market analysis agent
│       ├── executor.agent.ts   # Browser automation agent
│       └── synthesizer.agent.ts    # Response formatter
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── .env.example
```

## Available Scripts

| Command          | Description                              |
| ---------------- | ---------------------------------------- |
| `yarn dev`       | Start development server with hot reload |
| `yarn start`     | Start production server                  |
| `yarn typecheck` | Run TypeScript type checking             |
| `yarn clean`     | Remove build artifacts                   |

## Environment Variables

| Variable           | Description                   | Default                                                    |
| ------------------ | ----------------------------- | ---------------------------------------------------------- |
| `PORT`             | Server port                   | `8090`                                                     |
| `GEMINI_API_KEY`   | Gemini API key                | Required                                                   |
| `OPENAI_BASE_URL`  | OpenAI compatibility endpoint | `https://generativelanguage.googleapis.com/v1beta/openai/` |
| `CHROME_DEBUG_URL` | Chrome DevTools Protocol URL  | `http://127.0.0.1:9222`                                    |
| `TIMEZONE`         | Timezone for scheduling       | `UTC`                                                      |

## Extending the Agents

### Adding New Tools to Agents

Edit the agent files in `src/agents/` to add new capabilities:

```typescript
// Example: Adding a tool to the analyst agent
import { Agent, tool } from '@openai/agents';
import { z } from 'zod';

const myCustomTool = tool({
  name: 'my_tool',
  description: 'Description of what this tool does',
  parameters: z.object({
    param1: z.string().describe('Parameter description'),
  }),
  execute: async ({ param1 }) => {
    // Tool implementation
    return { result: 'success' };
  },
});

export function analystAgent(): Agent {
  return new Agent({
    name: 'Analyst Agent',
    instructions: '...',
    model: 'gemini-1.5-pro',
    tools: [myCustomTool],
  });
}
```

## Roadmap

- [ ] PostgreSQL integration for trade logging
- [ ] Puppeteer browser automation
- [ ] Scheduled analysis jobs (cron)
- [ ] TradingView chart screenshot integration
- [ ] Risk management controls

## License

MIT
