/**
 * Available OpenAI models for agents
 */
export enum ModelName {
  GPT_5_NANO = 'gpt-5-nano',
  GPT_5_MINI = 'gpt-5-mini',
  GPT_4O = 'gpt-4o',
  GPT_4O_MINI = 'gpt-4o-mini',
  GPT_4_TURBO = 'gpt-4-turbo',
  O1 = 'o1',
  O1_MINI = 'o1-mini',
  O3_MINI = 'o3-mini',
}

/**
 * Model configuration with metadata
 */
export const modelConfig: Record<
  ModelName,
  {
    name: string;
    description: string;
    contextWindow: number;
    supportsVision: boolean;
  }
> = {
  [ModelName.GPT_5_NANO]: {
    name: 'gpt-5-nano',
    description: 'Lightweight GPT-5 model optimized for speed and efficiency',
    contextWindow: 128000,
    supportsVision: true,
  },
  [ModelName.GPT_5_MINI]: {
    name: 'gpt-5-mini',
    description: 'Balanced GPT-5 model with excellent cost-performance ratio',
    contextWindow: 128000,
    supportsVision: true,
  },
  [ModelName.GPT_4O]: {
    name: 'gpt-4o',
    description: 'Most capable GPT-4 model with vision support',
    contextWindow: 128000,
    supportsVision: true,
  },
  [ModelName.GPT_4O_MINI]: {
    name: 'gpt-4o-mini',
    description: 'Smaller, faster GPT-4o variant',
    contextWindow: 128000,
    supportsVision: true,
  },
  [ModelName.GPT_4_TURBO]: {
    name: 'gpt-4-turbo',
    description: 'GPT-4 Turbo with improved performance',
    contextWindow: 128000,
    supportsVision: true,
  },
  [ModelName.O1]: {
    name: 'o1',
    description: 'Reasoning model for complex tasks',
    contextWindow: 200000,
    supportsVision: true,
  },
  [ModelName.O1_MINI]: {
    name: 'o1-mini',
    description: 'Smaller reasoning model',
    contextWindow: 128000,
    supportsVision: false,
  },
  [ModelName.O3_MINI]: {
    name: 'o3-mini',
    description: 'Latest mini reasoning model',
    contextWindow: 200000,
    supportsVision: true,
  },
};

/**
 * Default model for agents
 */
export const DEFAULT_MODEL = ModelName.GPT_5_MINI;
