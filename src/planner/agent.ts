import 'dotenv/config';
import { dailyPlannerAgent } from '../agents/planner.agent.js';

// Export the root agent for ADK devtools
export const rootAgent = dailyPlannerAgent;
