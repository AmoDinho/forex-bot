import { Agent, MCPServerStdio } from '@openai/agents';
import { analystSystemContext } from '../prompts';
import { ModelName, DEFAULT_MODEL } from '../utils';
import * as path from 'node:path';

// MCP Server instance - managed externally for lifecycle control
let playwrightMcpServer: MCPServerStdio | null = null;

/**
 * Browser configuration options
 */
export interface BrowserConfig {
  /** Path to persistent user data directory for cookies/session */
  userDataDir?: string;
  /** Whether to run in headless mode (set to false to see the browser) */
  headless?: boolean;
  /** Browser to use: chromium, firefox, webkit */
  browser?: 'chromium' | 'firefox' | 'webkit';
}

/**
 * Get browser configuration from environment variables
 */
function getBrowserConfig(): BrowserConfig {
  return {
    // Default to ./browser-data in project root for persistent sessions
    userDataDir:
      process.env.BROWSER_USER_DATA_DIR ||
      path.resolve(process.cwd(), 'browser-data'),
    // Set BROWSER_HEADLESS=false to see the browser window
    headless: process.env.BROWSER_HEADLESS !== 'false',
    browser: (process.env.BROWSER_TYPE as BrowserConfig['browser']) || 'chromium',
  };
}

/**
 * Initialize the Playwright MCP server
 * This should be called once at application startup
 *
 * @param config - Optional browser configuration (uses env vars by default)
 */
export async function initPlaywrightMcp(
  config?: Partial<BrowserConfig>
): Promise<MCPServerStdio> {
  if (playwrightMcpServer) {
    return playwrightMcpServer;
  }

  const browserConfig = { ...getBrowserConfig(), ...config };
  const { userDataDir, headless, browser } = browserConfig;

  console.log('Initializing Playwright MCP server...');
  console.log(`  Browser: ${browser}`);
  console.log(`  Headless: ${headless}`);
  console.log(`  User data dir: ${userDataDir}`);

  // Build command with options for persistent session
  const args = ['@playwright/mcp@latest'];

  if (browser) {
    args.push('--browser', browser);
  }

  if (userDataDir) {
    args.push('--user-data-dir', userDataDir);
  }

  // Add --no-headless to show browser window (useful for initial setup)
  if (headless === false) {
    args.push('--no-headless');
  }

  const fullCommand = `npx ${args.join(' ')}`;

  playwrightMcpServer = new MCPServerStdio({
    name: 'Playwright MCP Server',
    fullCommand,
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
      'Playwright MCP server not initialized. Call initPlaywrightMcp() first.',
    );
  }
  return playwrightMcpServer;
}

/**
 * Create the Analyst Agent
 * The agent uses the Playwright MCP server for browser automation
 * to navigate websites and analyze forex markets
 *
 * @param model - The model to use for this agent (defaults to DEFAULT_MODEL)
 */
export function analystAgent(model: ModelName = DEFAULT_MODEL): Agent {
  const mcpServer = getPlaywrightMcp();

  return new Agent({
    name: 'forex_analyst_agent',
    model: model,
    instructions: analystSystemContext,
    mcpServers: [mcpServer],
  });
}

/**
 * Create and return an Analyst Agent instance
 * This is an async factory that ensures MCP is initialized
 *
 * @param model - The model to use for this agent (defaults to DEFAULT_MODEL)
 */
export async function createAnalystAgent(
  model: ModelName = DEFAULT_MODEL,
): Promise<Agent> {
  await initPlaywrightMcp();
  return analystAgent(model);
}
