import { Agent, Tool } from '@openai/agents';
import { orchestratorPrompt } from '../prompts';

/**
 * Create the Orchestrator Agent
 * The orchestrator coordinates multiple tools/agents to fulfill user requests
 *
 * @param tools - Array of tools (including other agents as tools) available to the orchestrator
 */
export function orchestratorAgent(tools: Tool[]): Agent {
  return new Agent({
    name: 'forex_orchestrator_agent',
    model: 'gpt-4o',
    instructions: orchestratorPrompt,
    tools: tools,
  });
}
