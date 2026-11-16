import { z } from 'zod';

/**
 * Structured call insight. The Python VoiceDesk brief was free text with three sections
 * (top intents, missed opportunities, next actions); this keeps those sections but as typed fields
 * so a client can render them and the server can check them against the input records.
 */
export const InsightSchema = z.object({
  summary: z.string().min(1).max(600).describe('Two or three sentences for the business owner.'),
  topIntents: z
    .array(
      z.object({
        intent: z.string().min(1).max(120).describe('Short label for why people called.'),
        count: z.number().int().positive().describe('How many of the given calls had this intent.'),
      }),
    )
    .min(1)
    .max(5),
  missedOpportunities: z
    .array(
      z.object({
        callOutcomeId: z.number().int().positive().describe('id of one of the given call records'),
        reason: z.string().min(1).max(240),
      }),
    )
    .max(10),
  nextActions: z
    .array(
      z.object({
        action: z.string().min(1).max(240),
        priority: z.enum(['high', 'medium', 'low']),
      }),
    )
    .min(1)
    .max(5),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']).describe('Overall caller sentiment.'),
});

export type Insight = z.infer<typeof InsightSchema>;
