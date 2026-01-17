import { Agent } from '@openai/agents';

/**
 * Analyst Agent
 *
 * Responsible for analyzing market conditions using vision capabilities.
 * This agent will:
 * - Process chart screenshots
 * - Analyze PDF strategy documents
 * - Determine market bias (BULLISH/BEARISH/NEUTRAL)
 * - Identify key support/resistance levels
 *
 * TODO: Add vision tools for image analysis
 * TODO: Add PDF parsing capabilities
 */

const ANALYST_SYSTEM_PROMPT = `You are a professional Forex market analyst with expertise in technical analysis.

Your responsibilities:
1. Analyze chart images to identify trends, patterns, and key levels
2. Interpret strategy documents to understand trading rules
3. Provide clear market bias assessments (BULLISH, BEARISH, or NEUTRAL)
4. Identify key support and resistance levels
5. Explain your reasoning clearly and concisely

When analyzing charts, consider:
- Price action and candlestick patterns
- Support and resistance levels
- Trend direction and strength
- Volume patterns (if available)
- Key moving averages

Always respond with structured analysis in JSON format:
{
  "bias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "confidence": 0-100,
  "key_levels": {
    "support": [level1, level2],
    "resistance": [level1, level2]
  },
  "reasoning": "explanation of your analysis",
  "entry_signal": true | false,
  "recommended_action": "BUY" | "SELL" | "WAIT"
}`;

export function analystAgent(): Agent {
  return new Agent({
    name: 'Analyst Agent',
    instructions: ANALYST_SYSTEM_PROMPT,
    model: 'gemini-1.5-pro',
    // TODO: Add vision tools here when implementing image analysis
    // tools: [chartAnalysisTool, pdfParserTool],
  });
}

/**
 * Factory function to create an Analyst Agent instance
 * Use this when you need to initialize the agent with async operations
 */
export async function createAnalystAgent(): Promise<Agent> {
  // Placeholder for any async initialization (e.g., loading strategy PDFs)
  return analystAgent();
}
