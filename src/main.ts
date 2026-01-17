import 'dotenv/config';
import express, { Request, Response } from 'express';
import { run, setDefaultOpenAIKey, withTrace, Tool } from '@openai/agents';
import {
  orchestratorAgent,
  synthesizerAgent,
  createAnalystAgent,
  createExecutorAgent,
  closeExecutorAgent,
} from './agents';
import cors from 'cors';

const app = express();
const port = parseInt(process.env.PORT || '8080', 10);

// Add JSON body parsing middleware
app.use(cors());
app.use(express.json());

// Configure OpenAI SDK to use Gemini via compatibility layer
const configureGeminiClient = () => {
  // Set the API key for the agents SDK
  // The base URL is configured via OPENAI_BASE_URL environment variable
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY or OPENAI_API_KEY must be set');
  }
  setDefaultOpenAIKey(apiKey);
};

// Initialize orchestrator tools at startup
let orchestratorTools: Tool[] = [];
let analystAgentInstance: ReturnType<typeof createAnalystAgent> extends Promise<
  infer T
>
  ? T
  : never;
let executorAgentInstance: ReturnType<
  typeof createExecutorAgent
> extends Promise<infer T>
  ? T
  : never;

const initializeTools = async () => {
  try {
    console.log('Initializing orchestrator tools...');

    // Initialize the Analyst Agent
    console.log('Initializing Analyst Agent...');
    analystAgentInstance = await createAnalystAgent();

    const analystAgentTool = await analystAgentInstance.asTool({
      toolName: 'analyze_market',
      toolDescription:
        'Use this tool to analyze forex market conditions, chart patterns, and determine market bias. ' +
        'Provide chart screenshots or describe market conditions. ' +
        'Returns analysis with bias (BULLISH/BEARISH/NEUTRAL), confidence level, key support/resistance levels, and trading recommendations.',
    });
    orchestratorTools.push(analystAgentTool);
    console.log('✓ Analyst Agent tool initialized successfully');

    // Initialize the Executor Agent
    console.log('Initializing Executor Agent...');
    executorAgentInstance = await createExecutorAgent();

    const executorAgentTool = await executorAgentInstance.asTool({
      toolName: 'execute_browser_action',
      toolDescription:
        'Use this tool for browser automation and trade execution. ' +
        'Can navigate to pages, take screenshots, and execute buy/sell trades on the broker platform. ' +
        'Always use this after analysis confirms a trading signal.',
    });
    orchestratorTools.push(executorAgentTool);
    console.log('✓ Executor Agent tool initialized successfully');

    console.log(
      `✓ All tools initialized. Total tools: ${orchestratorTools.length}`
    );
  } catch (error) {
    console.error('Failed to initialize orchestrator tools:', error);
    // Continue without tools rather than crashing the server
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
// (in production, consider using a database with session management)
const conversationHistoryBySession = new Map<string, ConversationMessage[]>();

// Limit history to prevent memory issues (keep last N messages per session)
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

  // Trim history if it gets too long
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
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'ForexAI Trading Agent',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/ping',
      chat: 'POST /invocations',
      history: '/history?sessionId=<id>',
    },
  });
});

// Health check endpoint
app.get('/ping', async (_req: Request, res: Response) => {
  try {
    const toolsInitialized = orchestratorTools.length > 0;
    const analystAvailable = analystAgentInstance !== null;
    const executorAvailable = executorAgentInstance !== null;

    const isHealthy = toolsInitialized && analystAvailable && executorAvailable;

    const status = isHealthy ? 'Healthy' : 'Unhealthy';
    const statusCode = isHealthy ? 200 : 503;

    res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      details: {
        toolsInitialized,
        toolCount: orchestratorTools.length,
        analystAgentAvailable: analystAvailable,
        executorAgentAvailable: executorAvailable,
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

// Get conversation history for a specific session
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

// Main chat/invocation endpoint with SSE streaming
app.post('/invocations', async (req: Request, res: Response) => {
  console.log('🔍 [Main] POST /invocations request received');

  const { message, sessionId } = req.body;

  // Set up SSE headers early for consistent error responses
  const sendSSEError = (errorMessage: string, statusCode: number = 400) => {
    res.writeHead(statusCode, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });
    res.write(
      `data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`
    );
    res.end();
  };

  // Validate message
  if (!message || typeof message !== 'string') {
    sendSSEError('Message is required and must be a string');
    return;
  }

  // Validate sessionId
  if (!sessionId || typeof sessionId !== 'string') {
    sendSSEError('sessionId is required and must be a string');
    return;
  }

  // Get conversation context and add to user message
  const conversationContext = getConversationContext(sessionId);
  const contextualMessage = conversationContext
    ? `Previous conversation:\n${conversationContext}\n\nCurrent message: ${message}`
    : message;

  // Add user message to history
  addToHistory(sessionId, 'user', message);

  // Set up SSE headers for streaming
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  try {
    // Ensure tools are initialized
    await toolsPromise;

    // Send connection confirmation
    res.write(
      `data: ${JSON.stringify({
        type: 'connected',
        message: 'ForexAI Agent connected successfully',
      })}\n\n`
    );

    // Create orchestrator with available tools
    const orchestrator = orchestratorAgent(orchestratorTools);

    let assistantResponse = '';

    await withTrace('ForexAI Orchestrator', async () => {
      // Run the orchestrator
      const orchestratorResult = await run(orchestrator, contextualMessage);

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

      // Synthesize the final response
      const synthesizer = synthesizerAgent();
      const synthesizerResult = await run(
        synthesizer,
        orchestratorResult.output
      );

      assistantResponse = (synthesizerResult.finalOutput ??
        'No response generated') as string;

      // Add to history
      addToHistory(sessionId, 'assistant', assistantResponse);

      // Send final result
      res.write(
        `data: ${JSON.stringify({
          type: 'result',
          content: assistantResponse,
        })}\n\n`
      );

      // Send done event
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in /invocations:', error);

    addToHistory(sessionId, 'assistant', `Error: ${errorMessage}`);
    res.write(
      `data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`
    );
  } finally {
    res.end();
  }
});

// Start server
const startServer = async () => {
  try {
    // Configure Gemini client
    configureGeminiClient();

    // Wait for tools to initialize before starting
    await toolsPromise;

    app.listen(port, () => {
      console.log(`🚀 ForexAI Trading Agent Server listening on port ${port}`);
      console.log(`   Health check: http://localhost:${port}/ping`);
      console.log(
        `   Chat endpoint: POST http://localhost:${port}/invocations`
      );
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received, starting graceful shutdown...`);

  try {
    await closeExecutorAgent();
    console.log('✓ Executor Agent cleaned up successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
