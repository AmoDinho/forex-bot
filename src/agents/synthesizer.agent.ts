import { Agent } from '@openai/agents';
import { synthesizerPrompt } from '../prompts';
import { ModelName, DEFAULT_MODEL } from '../utils';

/**
 * Create the Synthesizer Agent
 * The synthesizer takes orchestrator output and generates a clear, formatted response
 *
 * @param model - The model to use for this agent (defaults to DEFAULT_MODEL)
 */
export function synthesizerAgent(model: ModelName = DEFAULT_MODEL): Agent {
  return new Agent({
    name: 'forex_synthesizer_agent',
    model: model,
    instructions: synthesizerPrompt,
  });
}
