Product Requirements Document (PRD): Autonomous Forex Trading Agent
Project Name: ForexAI-Agent Version: 1.0 Date: 2026-01-16 Status: Implementation Ready

1. Executive Summary
   We are building an autonomous AI agent system that acts as a Forex trading assistant. The system operates on a schedule to analyze market conditions (via PDF/image inputs) and execute trades (via browser automation) on a specific broker platform. It uses a "Human-in-the-Loop" architecture where daily strategies are generated for review, but trade execution is autonomous based on that strategy.

2. Core Objectives
   Autonomous Access: The agent must be able to connect to a running Chrome instance (via DevTools Protocol) to access the broker without manual login every time.

Strategic Analysis: Generate a daily market bias (Buy/Sell/Wait) by reading uploaded strategy PDFs and chart screenshots.

Scheduled Execution: Run a daily analysis job (08:00) and a high-frequency check (every 15 mins) to spot entry criteria.

Persistent Memory: Store analysis, decisions, and trade logs in a database for auditability.

3. Tech Stack & Constraints
   Runtime: Node.js (v20+) with TypeScript.

Server: Express.js.

AI Model: Gemini 1.5 Pro (via OpenAI Compatibility SDK).

Browser Automation: Puppeteer (connecting to existing Chrome instance via DevTools Protocol).

Database: PostgreSQL.

Scheduling: node-cron.

Agent Framework: OpenAI Agents SDK (or standard function calling if simpler).

4. System Architecture
   4.1. Orchestrator-Worker Pattern
   The system uses a central service (AgentOrchestrator) that manages two distinct "worker" personas.

Analyst Agent (Vision & Text):

Input: Chart screenshots, PDF strategy documents.

Task: Determine market bias and key levels.

Output: JSON object { bias: "BULLISH", confidence: 80, key_levels: [...] }.

Executor Agent (Browser Actions):

Input: Commands from Orchestrator.

Task: Navigate to URLs, take screenshots, click "Buy"/"Sell".

Tools: connect_to_browser, Maps_page, click_element, take_screenshot.

4.2. Database Schema
Table: daily_analysis

id (PK, Serial)

date (Date, Unique) - Ensures one plan per day.

market_bias (Varchar) - 'BULLISH', 'BEARISH', 'NEUTRAL'.

strategy_context (Text) - Summary of why this bias was chosen.

key_levels (JSONB) - e.g., { "support": 1.0500, "resistance": 1.0600 }.

created_at (Timestamp).

Table: trade_logs

id (PK, Serial)

analysis_id (FK -> daily_analysis.id).

symbol (Varchar) - e.g., "EURUSD".

action (Varchar) - 'BUY', 'SELL'.

status (Varchar) - 'EXECUTED', 'FAILED'.

screenshot_path (Text) - Local path to the screenshot taken at the moment of trade.

ai_reasoning (Text) - Why the agent took the trade.

timestamp (Timestamp).

5. Functional Requirements (Step-by-Step for Coding Agent)
   Phase 1: Infrastructure Setup
   Step 1.1: Initialize a TypeScript Node.js project.

Step 1.2: Set up Express server structure.

Step 1.3: Configure PostgreSQL connection using pg pool.

Step 1.4: Create migration scripts for the DB schema defined above.

Phase 2: Browser Connection Service
Requirement: The system must not launch a new browser. It must connect to port 9222.

```
Function: getBrowserConnection()

Use puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' }).
```

Return the browser instance.

Error Handling: If connection fails, throw a clear error ("Is Chrome running with remote-debugging-port?").

Phase 3: The Analyst Agent (Gemini Integration)
Function: analyzeMarket(imageBuffer: Buffer, strategyContext: string)

Prompt:

"You are a professional Forex trader. Analyze this chart image based on the following strategy rules: [INSERT STRATEGY]. Identify the trend, key support/resistance levels, and suggest a bias (BUY/SELL/WAIT). Return response in JSON format."

Model: Use gemini-1.5-pro (configured via OpenAI SDK base URL) to ensure large context window support for PDFs.

Phase 4: Cron Job Scheduling
Daily Job (08:00 Local Time):

Call getBrowserConnection.

Navigate to TradingView/Broker chart.

Take a screenshot.

Send to Analyst Agent with loaded PDF context.

Save result to daily_analysis table.

Intraday Job (Every 15 Mins):

Check daily_analysis for today. If no plan, Abort.

If plan exists, connect to browser and take fresh screenshot.

Send to Analyst Agent: "Given our daily bias is X, does this current chart show a valid entry signal?"

If YES -> Call executeTrade().

Phase 5: Trade Execution
Function: executeTrade(action: 'BUY' | 'SELL')

Logic:

Use Puppeteer to locate the "Buy" or "Sell" button on the broker interface.

Constraint: Use placeholder selectors (e.g., .buy-button) and add comments instructing the user to update them with real selectors.

Click the button.

Wait for confirmation modal/toast.

Log the trade to trade_logs.

6. Environment Variables (.env)
   Code snippet

```
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/forex_db
GEMINI_API_KEY=your_gemini_key
```

# Base URL for Gemini via OpenAI SDK

```
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
CHROME_DEBUG_URL=http://127.0.0.1:9222
TIMEZONE=Africa/Johannesburg
```

7. Definition of Done
   [ ] Server starts without errors.

[ ] Database tables are created.

[ ] "Test Connectivity" endpoint successfully takes a screenshot of the currently open Chrome tab.

[ ] Daily Cron job runs, analyzes a dummy image, and saves a record to DB.

[ ] Intraday Cron job reads the DB record and logs a "Check complete" message.
