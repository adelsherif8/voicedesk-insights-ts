import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Repository } from '../db/repository.js';
import type { CallOutcome } from '../db/schema.js';
import { onInvalid } from '../lib/validation.js';

export const AgentSlug = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]{0,39}$/, 'lowercase letters, digits and dashes, max 40 chars');
export const IdParam = z.object({ id: z.coerce.number().int().positive().max(2_147_483_647) });
const isoDate = z.iso.datetime({ offset: true }).transform((s) => new Date(s));

export const ListQuery = z
  .object({
    agent: AgentSlug.optional(),
    outcome: z.string().trim().min(1).max(100).optional(),
    q: z.string().trim().min(1).max(100).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { message: '`from` must be before `to`', path: ['from'] });

export const CreateCallOutcome = z
  .object({
    agent: AgentSlug,
    callerName: z.string().trim().max(120).default(''),
    phone: z.string().trim().max(40).default(''),
    email: z.union([z.email().max(254), z.literal('')]).default(''),
    intent: z.string().trim().min(1).max(200),
    outcome: z.string().trim().min(1).max(200),
    appointment: z.string().trim().max(200).default(''),
    summary: z.string().trim().max(2000).default(''),
    transcript: z.string().max(20_000).default(''),
    meta: z
      .record(z.string(), z.unknown())
      .default({})
      .refine((m) => JSON.stringify(m).length <= 8000, 'meta must serialise to at most 8000 characters'),
    createdAt: isoDate.optional(),
  })
  .strict();

export const toDto = (r: CallOutcome) => ({ ...r, createdAt: r.createdAt.toISOString() });

export function callOutcomeRoutes(repo: Repository) {
  return new Hono()
    .get('/', zValidator('query', ListQuery, onInvalid), async (c) => {
      const f = c.req.valid('query');
      const { rows, total } = await repo.list(f);
      return c.json({ data: rows.map(toDto), pagination: { limit: f.limit, offset: f.offset, total } });
    })
    .get('/stats', zValidator('query', z.object({ agent: AgentSlug.optional() }), onInvalid), async (c) => {
      return c.json(await repo.stats(c.req.valid('query').agent));
    })
    .get('/:id', zValidator('param', IdParam, onInvalid), async (c) => {
      const row = await repo.get(c.req.valid('param').id);
      if (!row) return c.json({ error: 'not_found' }, 404);
      return c.json(toDto(row));
    })
    .post('/', zValidator('json', CreateCallOutcome, onInvalid), async (c) => {
      const row = await repo.create(c.req.valid('json'));
      c.header('Location', `/call-outcomes/${row.id}`);
      return c.json(toDto(row), 201);
    });
}
