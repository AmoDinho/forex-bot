import { LlmAgent, SequentialAgent, MCPToolset } from '@google/adk';
import { dbWriterTool } from '../tools/forex.tools.js';
import { z } from 'zod';

/**
 * Stage 1: The Chart Scraper (Eyes)
 * Responsible for capturing the visual data from the broker using Playwright MCP.
 */
const playwrightToolset = new MCPToolset({
  type: 'StdioConnectionParams',
  serverParams: {
    command: 'npx',
    args: ['@playwright/mcp@latest'],
  },
});

const chartCaptureAgent = new LlmAgent({
  name: 'ChartScraper',
  model: 'gemini-1.5-flash',
  tools: [playwrightToolset],
  
  instruction: `
    Your goal is to capture a high-timeframe screenshot of the market chart.
    
    1. Navigate to the broker URL provided: {{broker_url}}
    2. Wait for the chart to load completely.
    3. Take a screenshot of the page.
    4. Respond with the path or confirmation that the screenshot was taken.
    
    Use the tools provided by the Playwright MCP server to achieve this.
  `,
});

/**
 * Stage 2: The Strategy Analyst (Brain)
 * The "Brain" that synthesizes PDF rules with visual chart data.
 */
const strategyAnalystAgent = new LlmAgent({
  name: 'StrategyAnalyst',
  model: 'gemini-1.5-pro', // High context for PDF text
  includeContents: 'none',
  instruction: `
    You are a Master Forex Strategist.
    
    CONTEXT:
    1. Strategy PDF Rules: {{strategy_pdf_text}}
    2. Morning Chart Screenshot: {{morning_chart_image}} (Analyze the visual data from the chart)
    
    TASK:
    Analyze the chart based strictly on the PDF rules provided in the context.
    - Determine Market Bias (BULLISH, BEARISH, or NEUTRAL).
    - Identify 3 Key Support/Resistance levels from the chart.
    - Summarize the reasoning behind your bias and levels.
  `,
});

/**
 * Stage 3: The Database Persister (Hands)
 * Responsible for saving the finalized plan to the database.
 */
const dbPersisterAgent = new LlmAgent({
  name: 'DBPersister',
  model: 'gemini-1.5-flash',
  tools: [dbWriterTool],
  instruction: `
    You will receive a JSON object containing a trading plan (bias, levels, and reasoning).
    Extract this data and call the save_daily_plan tool to persist it to the database.
    Report the status of the save operation.
  `,
});

/**
 * The Root Sequential Agent
 * Bundles the stages together for a reliable 08:00 AM workflow.
 */
export const dailyPlannerAgent = new SequentialAgent({
  name: 'DailyPlanner',
  description: 'Strict linear sequence to establish daily trading bias.',

  subAgents: [
    chartCaptureAgent,
    strategyAnalystAgent,
    dbPersisterAgent,
  ],
  
});
