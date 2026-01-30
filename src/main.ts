import 'dotenv/config';
import express, { Request, Response } from 'express';
import { run, setDefaultOpenAIKey, withTrace, Tool } from '@openai/agents';
import {
  createAnalystAgent,
  closePlaywrightMcp,
  initPlaywrightMcp,
  orchestratorAgent,
  synthesizerAgent,
} from './agents';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 8080;

// Add JSON body parsing middleware
app.use(cors());
app.use(express.json());

// Initialize orchestrator tools at startup
let orchestratorTools: Tool[] = [];
let analystAgentInstance: Awaited<ReturnType<typeof createAnalystAgent>> | null =
  null;

/**
 * Initialize all agents and tools
 */
const initializeTools = async () => {
  try {
    console.log('Initializing orchestrator tools...');

    // Initialize MCP server first
    await initPlaywrightMcp();

    // Initialize the analyst agent
    console.log('Initializing Analyst Agent...');
    analystAgentInstance = await createAnalystAgent();

    // Convert analyst agent to a tool for the orchestrator
    const analystTool = await analystAgentInstance.asTool({
      toolName: 'analyze_forex_market',
      toolDescription:
        'Use this tool to analyze forex markets. The analyst can navigate to financial websites, view charts, and provide technical analysis including market bias, key support/resistance levels, and trading recommendations. Provide clear instructions about which currency pair to analyze and any specific requirements.',
    });
    orchestratorTools.push(analystTool);

    console.log('✓ Analyst Agent tool initialized successfully');
    console.log(`✓ Orchestrator initialized with ${orchestratorTools.length} tool(s)`);
  } catch (error) {
    console.error('Failed to initialize orchestrator tools:', error);
    orchestratorTools = [];
  }
};

// Start tool initialization immediately
const toolsPromise = initializeTools();

// Conversation history storage
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sessionId: string;
}

// In-memory conversation history organized by session
const conversationHistoryBySession = new Map<string, ConversationMessage[]>();

const MAX_HISTORY_LENGTH = 50;

function addToHistory(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
) {
  if (!conversationHistoryBySession.has(sessionId)) {
    conversationHistoryBySession.set(sessionId, []);
  }

  const sessionHistory = conversationHistoryBySession.get(sessionId)!;

  sessionHistory.push({
    role,
    content,
    timestamp: new Date(),
    sessionId,
  });

  if (sessionHistory.length > MAX_HISTORY_LENGTH) {
    sessionHistory.splice(0, sessionHistory.length - MAX_HISTORY_LENGTH);
  }
}

function getConversationContext(sessionId: string): string {
  const sessionHistory = conversationHistoryBySession.get(sessionId);

  if (!sessionHistory || sessionHistory.length === 0) {
    return '';
  }

  return (
    sessionHistory.map((msg) => `${msg.role}: ${msg.content}`).join('\n') + '\n'
  );
}

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'ForexAI Trading Agent',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/ping',
      analyze: 'POST /analyze',
      history: 'GET /history?sessionId=xxx',
      clearHistory: 'DELETE /history?sessionId=xxx',
    },
  });
});

// Health check endpoint
app.get('/ping', async (req: Request, res: Response) => {
  try {
    const toolsInitialized = orchestratorTools.length > 0;
    const analystAgentAvailable = analystAgentInstance !== null;
    const isHealthy = toolsInitialized && analystAgentAvailable;

    const status = isHealthy ? 'Healthy' : 'Unhealthy';
    const statusCode = isHealthy ? 200 : 503;

    res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      details: {
        toolsInitialized,
        toolCount: orchestratorTools.length,
        analystAgentAvailable,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'Unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get conversation history
app.get('/history', (req: Request, res: Response) => {
  const { sessionId } = req.query;

  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({
      error: 'sessionId query parameter is required and must be a string',
    });
    return;
  }

  const sessionHistory = conversationHistoryBySession.get(sessionId) || [];

  res.json({
    sessionId,
    history: sessionHistory,
    count: sessionHistory.length,
  });
});

// Clear conversation history
app.delete('/history', (req: Request, res: Response) => {
  const { sessionId } = req.query;

  if (sessionId && typeof sessionId === 'string') {
    conversationHistoryBySession.delete(sessionId);
    res.json({
      message: `Conversation history cleared for session ${sessionId}`,
    });
  } else {
    conversationHistoryBySession.clear();
    res.json({ message: 'All conversation history cleared' });
  }
});

/**
 * Main analysis endpoint
 * Uses orchestrator -> analyst -> synthesizer pattern
 *
 * Example request body:
 * {
 *   "message": "Analyze EURUSD on the 4H timeframe",
 *   "sessionId": "session-123"
 * }
 */
app.post('/analyze', async (req: Request, res: Response) => {
  console.log('📊 [Orchestrator] POST /analyze request received');

  const { message, sessionId } = req.body;

  // Validate message
  if (!message || typeof message !== 'string') {
    res.status(400).json({
      error: 'message is required and must be a string',
    });
    return;
  }

  // Generate sessionId if not provided
  const currentSessionId =
    sessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Set up SSE headers for streaming response
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Ensure OpenAI key is set
  if (!process.env.OPENAI_API_KEY) {
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        content: 'OPENAI_API_KEY environment variable is not set',
      })}\n\n`
    );
    res.end();
    return;
  }

  setDefaultOpenAIKey(process.env.OPENAI_API_KEY);

  try {
    // Wait for tools to be initialized
    await toolsPromise;

    if (orchestratorTools.length === 0) {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          content: 'Orchestrator tools not available. Please try again later.',
        })}\n\n`
      );
      res.end();
      return;
    }

    // Send connection event
    res.write(
      `data: ${JSON.stringify({
        type: 'connected',
        message: 'Agent connected successfully',
        sessionId: currentSessionId,
      })}\n\n`
    );

    // Build context with conversation history
    const conversationContext = getConversationContext(currentSessionId);
    const contextualMessage = conversationContext
      ? `Previous conversation:\n${conversationContext}\n\nCurrent request: ${message}`
      : message;

    // Add user message to history
    addToHistory(currentSessionId, 'user', message);

    let assistantResponse: string = '';

    await withTrace('ForexAI Analysis', async () => {
      // Send orchestrator processing event
      res.write(
        `data: ${JSON.stringify({
          type: 'processing',
          message: 'Orchestrator coordinating analysis...',
        })}\n\n`
      );

      // Step 1: Run the orchestrator with available tools
      const orchestratorInstance = orchestratorAgent(orchestratorTools);
      const orchestratorResult = await run(orchestratorInstance, contextualMessage);

      // Stream orchestrator steps
      for (const item of orchestratorResult.newItems) {
        if (item.type === 'message_output_item') {
          const text = item.content;
          if (text) {
            res.write(
              `data: ${JSON.stringify({ type: 'step', content: text })}\n\n`
            );
          }
        }
      }

      // Send synthesizer processing event
      res.write(
        `data: ${JSON.stringify({
          type: 'processing',
          message: 'Synthesizing results...',
        })}\n\n`
      );

      // Step 2: Run the synthesizer to format the final output
      const synthesizerInstance = synthesizerAgent();
      const synthesizerResult = await run(
        synthesizerInstance,
        orchestratorResult.output
      );

      assistantResponse = (synthesizerResult.finalOutput ??
        'No response generated') as string;

      // Add assistant response to history
      addToHistory(currentSessionId, 'assistant', assistantResponse);

      // Send final result
      res.write(
        `data: ${JSON.stringify({
          type: 'result',
          content: assistantResponse,
          sessionId: currentSessionId,
        })}\n\n`
      );

      // Send done event
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    console.error('Analysis error:', error);

    addToHistory(currentSessionId, 'assistant', `Error: ${errorMessage}`);

    res.write(
      `data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`
    );
  } finally {
    res.end();
  }
});

// Start the server
app.listen(port, () => {
  console.log(`🤖 ForexAI Trading Agent Server listening on port ${port}`);
  console.log(`   Health check: http://localhost:${port}/ping`);
  console.log(`   Analyze: POST http://localhost:${port}/analyze`);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received, starting graceful shutdown...`);

  try {
    await closePlaywrightMcp();
    console.log('✓ Playwright MCP server cleaned up successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
