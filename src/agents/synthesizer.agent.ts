import { Agent } from '@openai/agents';
import { synthesizerPrompt } from '../prompts';

/**
 * Create the Synthesizer Agent
 * The synthesizer takes orchestrator output and generates a clear, formatted response
 */
export function synthesizerAgent(): Agent {
  return new Agent({
    name: 'forex_synthesizer_agent',
    model: 'gpt-4o',
    instructions: synthesizerPrompt,
  });
}
