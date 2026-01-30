import { Agent, Tool } from '@openai/agents';
import { orchestratorPrompt } from '../prompts';
import { ModelName, DEFAULT_MODEL } from '../utils';

/**
 * Create the Orchestrator Agent
 * The orchestrator coordinates multiple tools/agents to fulfill user requests
 *
 * @param tools - Array of tools (including other agents as tools) available to the orchestrator
 * @param model - The model to use for this agent (defaults to DEFAULT_MODEL)
 */
export function orchestratorAgent(
  tools: Tool[],
  model: ModelName = DEFAULT_MODEL
): Agent {
  return new Agent({
    name: 'forex_orchestrator_agent',
    model: model,
    instructions: orchestratorPrompt,
    tools: tools,
  });
}
