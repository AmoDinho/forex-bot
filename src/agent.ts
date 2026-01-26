import 'dotenv/config';
import express, { Request, Response } from 'express';
import { dailyPlannerAgent } from './agents/planner.agent.js';
import { analystAgent } from './agents/analyst.agent.js';
import { executorAgent, closeExecutorAgent } from './agents/executor.agent.js';
import cors from 'cors';
import { Runner, stringifyContent, InMemorySessionService, getFunctionCalls, getFunctionResponses } from '@google/adk';

const app = express();
const port = parseInt(process.env.PORT || '8090', 10);

app.use(cors());
app.use(express.json());

// Shared session service to persist sessions in memory across requests
const sessionService = new InMemorySessionService();
const APP_NAME = 'ForexBot';

// Helper to run an agent and get the final text response
async function runAgent(agent: any, input: string, sessionId: string, stateDelta?: Record<string, any>) {
  const runner = new Runner({
    appName: APP_NAME,
    agent,
    sessionService
  });

  // Ensure session exists in the service
  const session = await sessionService.getSession({
    appName: APP_NAME,
    userId: 'default-user',
    sessionId: sessionId
  });

  if (!session) {
    await sessionService.createSession({
      appName: APP_NAME,
      userId: 'default-user',
      sessionId: sessionId
    });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`▶ Starting agent: ${agent.name}`);
  console.log(`  Session: ${sessionId}`);
  console.log(`  Input: ${input.substring(0, 100)}${input.length > 100 ? '...' : ''}`);
  console.log(`${'='.repeat(60)}`);

  const events = runner.runAsync({
    userId: 'default-user',
    sessionId: sessionId,
    newMessage: { parts: [{ text: input }] },
    ...(stateDelta ? { stateDelta } : {})
  });
  
  let finalOutput = '';
  let eventCount = 0;
  
  for await (const event of events) {
    eventCount++;
    const author = event.author || 'unknown';
    
    // Log tool/function calls
    const functionCalls = getFunctionCalls(event);
    if (functionCalls.length > 0) {
      for (const call of functionCalls) {
        console.log(`\n🔧 [${author}] TOOL CALL: ${call.name}`);
        console.log(`   Args: ${JSON.stringify(call.args, null, 2).substring(0, 200)}`);
      }
    }
    
    // Log tool/function responses
    const functionResponses = getFunctionResponses(event);
    if (functionResponses.length > 0) {
      for (const resp of functionResponses) {
        const respStr = JSON.stringify(resp.response, null, 2);
        console.log(`\n✅ [${author}] TOOL RESPONSE: ${resp.name}`);
        console.log(`   Result: ${respStr.substring(0, 300)}${respStr.length > 300 ? '...' : ''}`);
      }
    }
    
    // Log text output
    const text = stringifyContent(event);
    if (text) {
      console.log(`\n💬 [${author}] TEXT OUTPUT:`);
      console.log(`   ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
      finalOutput = text;
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✓ Agent ${agent.name} completed (${eventCount} events)`);
  console.log(`${'='.repeat(60)}\n`);
  
  return finalOutput;
}
// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'ForexAI Trading Agent (Google ADK)',
    version: '2.0.0',
    status: 'running',
    endpoints: {
      health: '/ping',
      chat: 'POST /invocations',
      plan: 'POST /plan',
    },
  });
});

// Health check endpoint
app.get('/ping', async (_req: Request, res: Response) => {
  res.json({
    status: 'Healthy',
    timestamp: new Date().toISOString(),
    framework: 'Google ADK',
  });
});

// Daily Plan trigger endpoint
app.post('/plan', async (req: Request, res: Response) => {
  const { strategy_pdf_text, broker_url, sessionId = 'daily-plan-session' } = req.body;
  
  if (!strategy_pdf_text || !broker_url) {
    res.status(400).json({ error: 'strategy_pdf_text and broker_url are required' });
    return;
  }

  try {
    console.log('🚀 Starting Daily Planner sequence...');
    // We pass a structured input string that the SequentialAgent's first sub-agent can parse
    const input = JSON.stringify({ strategy_pdf_text, broker_url });
    const result = await runAgent(dailyPlannerAgent, input, sessionId, {
      strategy_pdf_text,
      broker_url,
      morning_chart_image: 'morning_chart.png' // Provide a default if not set yet
    });

    res.json({
      status: 'success',
      result
    });
  } catch (error) {
    console.error('Error running daily planner:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Main chat/invocation endpoint
app.post('/invocations', async (req: Request, res: Response) => {
  const { message, sessionId = 'default-session', agentType } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  try {
    let targetAgent;
    switch (agentType) {
      case 'executor':
        targetAgent = executorAgent;
        break;
      case 'planner':
        targetAgent = dailyPlannerAgent;
        break;
      default:
        targetAgent = analystAgent;
    }

    console.log(`🤖 Running agent: ${targetAgent.name}`);
    const result = await runAgent(targetAgent, message, sessionId);

    res.json({
      type: 'result',
      content: result,
      sessionId
    });
  } catch (error) {
    console.error('Error in /invocations:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Start server
const startServer = async () => {
  app.listen(port, () => {
    console.log(`🚀 ForexAI Trading Agent Server (ADK) listening on port ${port}`);
  });
};

startServer();

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received, starting graceful shutdown...`);
  try {
    await closeExecutorAgent();
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

