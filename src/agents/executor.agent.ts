import { LlmAgent, MCPToolset } from '@google/adk';

const playwrightToolset = new MCPToolset({
  type: 'StdioConnectionParams',
  serverParams: {
    command: 'npx',
    args: ['@playwright/mcp@latest'],
  },
});

const EXECUTOR_INSTRUCTIONS = `You are a trade execution specialist responsible for browser automation on trading platforms.

Your responsibilities:
1. Connect to and control the browser via Playwright.
2. Navigate to specific pages on the broker platform.
3. Take screenshots of charts and trading interfaces.
4. Execute buy and sell orders when instructed.
5. Verify trade confirmations.

Respond with execution status in JSON format:
{
  "action": "BUY" | "SELL" | "SCREENSHOT" | "NAVIGATE",
  "status": "SUCCESS" | "FAILED" | "PENDING",
  "details": "description of what happened",
  "screenshot_path": "path to screenshot if applicable",
  "error": "error message if failed"
}`;

export const executorAgent = new LlmAgent({
  name: 'ExecutorAgent',
  model: 'gemini-1.5-flash',
  tools: [playwrightToolset],
  instruction: EXECUTOR_INSTRUCTIONS,
});

export async function createExecutorAgent() {
  return executorAgent;
}

export async function closeExecutorAgent() {
  console.log('Executor Agent cleanup');
}
