import { and, count, desc, eq, gte, ilike, inArray, lte, or, type SQL, sql } from 'drizzle-orm';
import { classifyOutcome } from '../insights/classify.js';
import type { Db } from './client.js';
import { type CallInsightRow, type CallOutcome, callInsights, callOutcomes, type NewCallOutcome } from './schema.js';

export interface ListFilters {
  agent?: string;
  outcome?: string;
  q?: string;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
}

/** LIKE wildcards in user input are matched literally. */
const likeContains = (s: string): string => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

function whereFor(f: Omit<ListFilters, 'limit' | 'offset'>): SQL | undefined {
  const conds: (SQL | undefined)[] = [];
  if (f.agent) conds.push(eq(callOutcomes.agent, f.agent));
  if (f.outcome) conds.push(ilike(callOutcomes.outcome, likeContains(f.outcome)));
  if (f.q) {
    const p = likeContains(f.q);
    conds.push(or(ilike(callOutcomes.intent, p), ilike(callOutcomes.summary, p)));
  }
  if (f.from) conds.push(gte(callOutcomes.createdAt, f.from));
  if (f.to) conds.push(lte(callOutcomes.createdAt, f.to));
  return conds.length ? and(...conds) : undefined;
}

export function createRepository(db: Db) {
  return {
    async list(f: ListFilters): Promise<{ rows: CallOutcome[]; total: number }> {
      const where = whereFor(f);
      const [rows, totals] = await Promise.all([
        db
          .select()
          .from(callOutcomes)
          .where(where)
          .orderBy(desc(callOutcomes.createdAt), desc(callOutcomes.id))
          .limit(f.limit)
          .offset(f.offset),
        db.select({ n: count() }).from(callOutcomes).where(where),
      ]);
      return { rows, total: totals[0]?.n ?? 0 };
    },

    async get(id: number): Promise<CallOutcome | undefined> {
      const [row] = await db.select().from(callOutcomes).where(eq(callOutcomes.id, id)).limit(1);
      return row;
    },

    async create(input: NewCallOutcome): Promise<CallOutcome> {
      const [row] = await db.insert(callOutcomes).values(input).returning();
      if (!row) throw new Error('insert returned no row');
      return row;
    },

    /** Most recent outcomes for one agent (or all), or exactly the ids asked for. */
    async forInsight(opts: { agent?: string; ids?: number[]; limit: number }): Promise<CallOutcome[]> {
      const conds: SQL[] = [];
      if (opts.agent) conds.push(eq(callOutcomes.agent, opts.agent));
      if (opts.ids?.length) conds.push(inArray(callOutcomes.id, opts.ids));
      return db
        .select()
        .from(callOutcomes)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(callOutcomes.createdAt), desc(callOutcomes.id))
        .limit(opts.limit);
    },

    /** Port of VoiceDesk db.stats(): totals, converted, last 24h, and count per agent. */
    async stats(agent?: string, now: Date = new Date()) {
      const where = agent ? eq(callOutcomes.agent, agent) : undefined;
      const [outcomes, perAgentRows, recent] = await Promise.all([
        db.select({ outcome: callOutcomes.outcome }).from(callOutcomes).where(where),
        db.select({ agent: callOutcomes.agent, n: count() }).from(callOutcomes).groupBy(callOutcomes.agent),
        db
          .select({ n: count() })
          .from(callOutcomes)
          .where(and(where, gte(callOutcomes.createdAt, new Date(now.getTime() - 86_400_000)))),
      ]);
      const byClass = { converted: 0, open: 0, informational: 0 };
      for (const o of outcomes) byClass[classifyOutcome(o.outcome)] += 1;
      return {
        total: outcomes.length,
        ...byClass,
        last24h: recent[0]?.n ?? 0,
        perAgent: Object.fromEntries(perAgentRows.map((r) => [r.agent, r.n])),
      };
    },

    async saveInsight(row: Omit<typeof callInsights.$inferInsert, 'id' | 'createdAt'>): Promise<CallInsightRow> {
      const [saved] = await db.insert(callInsights).values(row).returning();
      if (!saved) throw new Error('insert returned no row');
      return saved;
    },

    async getInsight(id: number): Promise<CallInsightRow | undefined> {
      const [row] = await db.select().from(callInsights).where(eq(callInsights.id, id)).limit(1);
      return row;
    },

    async ping(): Promise<void> {
      await db.execute(sql`select 1`);
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;
