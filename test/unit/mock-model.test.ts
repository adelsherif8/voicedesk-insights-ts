import { generateText, Output } from 'ai';
import { describe, expect, it } from 'vitest';
import { createMockModel, heuristicInsight } from '../../src/insights/mock-model.js';
import type { BriefRow } from '../../src/insights/redact.js';
import { InsightSchema } from '../../src/insights/schema.js';

const rows: BriefRow[] = [
  { id: 1, intent: 'Rent a storage unit', outcome: 'Reserved 10x10', summary: '' },
  { id: 2, intent: 'Rent a storage unit', outcome: 'Follow-up sent', summary: '' },
  { id: 3, intent: 'Takeout · lasagna', outcome: 'Order to kitchen', summary: '' },
  { id: 4, intent: 'Opening hours?', outcome: 'Answered', summary: '' },
];

describe('heuristicInsight', () => {
  it('is deterministic and schema-valid', () => {
    const a = heuristicInsight(rows);
    expect(heuristicInsight(rows)).toEqual(a);
    expect(InsightSchema.safeParse(a).success).toBe(true);
  });

  it('counts intents, lists open calls as missed and picks sentiment', () => {
    const i = heuristicInsight(rows);
    expect(i.topIntents[0]).toEqual({ intent: 'rent a storage unit', count: 2 });
    expect(i.topIntents.map((t) => t.intent)).toContain('takeout');
    expect(i.missedOpportunities.map((m) => m.callOutcomeId)).toEqual([2]);
    expect(i.nextActions[0]).toMatchObject({ priority: 'high' });
    expect(i.sentiment).toBe('mixed');
    expect(i.summary).toContain('4 call(s) analysed: 2 converted, 1 still open, 1 informational');
  });

  it('positive when most calls convert, negative when most are open', () => {
    const won = rows.map((r) => ({ ...r, outcome: 'Booked' }));
    expect(heuristicInsight(won).sentiment).toBe('positive');
    expect(heuristicInsight(won).missedOpportunities).toEqual([]);
    const lost = rows.map((r) => ({ ...r, outcome: 'Missed call' }));
    expect(heuristicInsight(lost).sentiment).toBe('negative');
    const neutral = rows.map((r) => ({ ...r, outcome: 'Answered' }));
    expect(heuristicInsight(neutral).sentiment).toBe('neutral');
  });
});

describe('createMockModel', () => {
  it('goes through generateText + Output.object like a real provider', async () => {
    const result = await generateText({
      model: createMockModel({ rows }),
      prompt: 'x',
      output: Output.object({ schema: InsightSchema }),
    });
    expect(result.output).toEqual(heuristicInsight(rows));
  });

  it('invalid mode produces output that fails the schema', async () => {
    const model = createMockModel({ rows, invalid: true });
    expect(model.modelId).toBe('deterministic-v1-invalid');
    await expect(
      generateText({ model, prompt: 'x', output: Output.object({ schema: InsightSchema }) }).then((r) => r.output),
    ).rejects.toThrow();
  });

  it('does not support streaming', async () => {
    await expect(createMockModel({ rows }).doStream({ prompt: [] })).rejects.toThrow(/stream/);
  });
});
