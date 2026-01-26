import { LlmAgent } from '@google/adk';

export const rootAgent = new LlmAgent({
  name: 'TestAgent',
  model: 'gemini-1.5-flash',
  instruction: 'You are a helpful assistant.',
});
