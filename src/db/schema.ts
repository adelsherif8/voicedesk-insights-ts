import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * One captured phone call and what came of it. Mirrors the `records` table in the Python
 * VoiceDesk app (app/db.py): agent, caller, intent, outcome, appointment, summary, transcript,
 * plus a free-form `meta` object for use-case-specific fields (unit size, order items, ...).
 */
export const callOutcomes = pgTable(
  'call_outcomes',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    agent: text('agent').notNull(),
    callerName: text('caller_name').notNull().default(''),
    phone: text('phone').notNull().default(''),
    email: text('email').notNull().default(''),
    intent: text('intent').notNull(),
    outcome: text('outcome').notNull(),
    appointment: text('appointment').notNull().default(''),
    summary: text('summary').notNull().default(''),
    transcript: text('transcript').notNull().default(''),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    /** true for rows written by the seed script, so fake data is never mistaken for real calls */
    isSample: boolean('is_sample').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [index('call_outcomes_agent_created_idx').on(t.agent, t.createdAt.desc(), t.id.desc())],
);

/** A generated insight, stored with which provider produced it and whether the fallback ran. */
export const callInsights = pgTable('call_insights', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  agent: text('agent'),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  fallbackUsed: boolean('fallback_used').notNull().default(false),
  fallbackReason: text('fallback_reason'),
  callOutcomeIds: jsonb('call_outcome_ids').$type<number[]>().notNull(),
  insight: jsonb('insight').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export type CallOutcome = typeof callOutcomes.$inferSelect;
export type NewCallOutcome = typeof callOutcomes.$inferInsert;
export type CallInsightRow = typeof callInsights.$inferSelect;
