import { Agent, MCPServerStdio } from '@openai/agents';
import { analystSystemContext } from '../prompts/index.js';

// MCP Server instance - managed externally for lifecycle control
let playwrightMcpServer: MCPServerStdio | null = null;

/**
 * Initialize the Playwright MCP server
 * This should be called once at application startup
 */
export async function initPlaywrightMcp(): Promise<MCPServerStdio> {
  if (playwrightMcpServer) {
    return playwrightMcpServer;
  }

  console.log('Initializing Playwright MCP server...');

  playwrightMcpServer = new MCPServerStdio({
    name: 'Playwright MCP Server',
    fullCommand: 'npx @playwright/mcp@latest',
  });

  await playwrightMcpServer.connect();
  console.log('✓ Playwright MCP server connected');

  return playwrightMcpServer;
}

/**
 * Close the Playwright MCP server
 * This should be called during graceful shutdown
 */
export async function closePlaywrightMcp(): Promise<void> {
  if (playwrightMcpServer) {
    console.log('Closing Playwright MCP server...');
    await playwrightMcpServer.close();
    playwrightMcpServer = null;
    console.log('✓ Playwright MCP server closed');
  }
}

/**
 * Get the current Playwright MCP server instance
 * Throws if not initialized
 */
export function getPlaywrightMcp(): MCPServerStdio {
  if (!playwrightMcpServer) {
    throw new Error(
      'Playwright MCP server not initialized. Call initPlaywrightMcp() first.'
    );
  }
  return playwrightMcpServer;
}

/**
 * Create the Analyst Agent
 * The agent uses the Playwright MCP server for browser automation
 * to navigate websites and analyze forex markets
 */
export function analystAgent(): Agent {
  const mcpServer = getPlaywrightMcp();

  return new Agent({
    name: 'forex_analyst_agent',
    model: 'gpt-4o',
    instructions: analystSystemContext,
    mcpServers: [mcpServer],
  });
}

/**
 * Create and return an Analyst Agent instance
 * This is an async factory that ensures MCP is initialized
 */
export async function createAnalystAgent(): Promise<Agent> {
  await initPlaywrightMcp();
  return analystAgent();
}
