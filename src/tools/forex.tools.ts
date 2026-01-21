import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { query } from '../database/client';

/**
 * Tool to save the daily trading plan to the database
 */
export const dbWriterTool = new FunctionTool({
  name: 'save_daily_plan',
  description: 'Saves the generated trading plan to the PostgreSQL database.',
  parameters: z.object({
    bias: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']),
    levels: z.array(z.number()),
    reasoning: z.string(),
  }),
  execute: async ({ bias, levels, reasoning }) => {
    try {
      const sql = `
        INSERT INTO daily_analysis (bias, support_resistance_levels, reasoning, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING id;
      `;
      // We store levels as a JSON string for simplicity in the 'support_resistance_levels' column
      const result = await query(sql, [bias, JSON.stringify(levels), reasoning]);
      return { 
        status: 'success', 
        message: `Plan saved with ID: ${result.rows[0].id}`,
        id: result.rows[0].id 
      };
    } catch (error) {
      console.error('Error saving daily plan:', error);
      return { status: 'error', error_message: error instanceof Error ? error.message : String(error) };
    }
  },
});
