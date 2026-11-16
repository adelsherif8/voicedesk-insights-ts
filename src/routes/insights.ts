import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Repository } from '../db/repository.js';
import type { CallInsightRow } from '../db/schema.js';
import { generateInsight, InsightGenerationError } from '../insights/generate.js';
import type { ModelResolver } from '../insights/providers.js';
import { toBriefRows } from '../insights/redact.js';
import { onInvalid } from '../lib/validation.js';
import { AgentSlug, IdParam } from './call-outcomes.js';

export const CreateInsight = z
  .object({
    agent: AgentSlug.optional(),
    callOutcomeIds: z.array(z.number().int().positive().max(2_147_483_647)).min(1).max(50).optional(),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();

const toDto = (r: CallInsightRow) => ({ ...r, createdAt: r.createdAt.toISOString() });

export function insightRoutes(repo: Repository, resolveModels: ModelResolver) {
  return new Hono()
    .post('/', zValidator('json', CreateInsight, onInvalid), async (c) => {
      const body = c.req.valid('json');
      const ids = body.callOutcomeIds ? [...new Set(body.callOutcomeIds)] : undefined;
      const records = await repo.forInsight({ agent: body.agent, ids, limit: ids ? ids.length : body.limit });

      if (ids && records.length !== ids.length) {
        const found = new Set(records.map((r) => r.id));
        return c.json({ error: 'not_found', missing: ids.filter((id) => !found.has(id)) }, 404);
      }
      if (records.length === 0) return c.json({ error: 'no_call_outcomes', message: 'nothing to analyse' }, 422);

      const rows = toBriefRows(records);
      try {
        const result = await generateInsight({ agent: body.agent ?? null, rows, chain: resolveModels(rows) });
        const saved = await repo.saveInsight({
          agent: body.agent ?? null,
          provider: result.provider,
          model: result.model,
          fallbackUsed: result.fallbackUsed,
          fallbackReason: result.fallbackReason,
          callOutcomeIds: rows.map((r) => r.id),
          insight: result.insight,
        });
        c.header('Location', `/insights/${saved.id}`);
        return c.json({ ...toDto(saved), attempts: result.attempts }, 201);
      } catch (err) {
        if (err instanceof InsightGenerationError) {
          return c.json({ error: 'insight_generation_failed', attempts: err.attempts }, 502);
        }
        throw err;
      }
    })
    .get('/:id', zValidator('param', IdParam, onInvalid), async (c) => {
      const row = await repo.getInsight(c.req.valid('param').id);
      if (!row) return c.json({ error: 'not_found' }, 404);
      return c.json(toDto(row));
    });
}
