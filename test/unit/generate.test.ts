import { APICallError } from 'ai';
import { describe, expect, it } from 'vitest';
import {
  checkGrounding,
  classifyFailure,
  GroundingError,
  generateInsight,
  InsightGenerationError,
} from '../../src/insights/generate.js';
import { heuristicInsight } from '../../src/insights/mock-model.js';
import type { BriefRow } from '../../src/insights/redact.js';
import { fakeModel, promptText } from '../helpers/models.js';

const rows: BriefRow[] = [
  { id: 11, intent: 'Rent a unit', outcome: 'Reserved 5x5', summary: 'Reserved' },
  { id: 12, intent: 'Rent a unit', outcome: 'Follow-up sent', summary: 'Quote texted' },
];
const good = heuristicInsight(rows);

describe('generateInsight', () => {
  it('returns the primary provider output when it validates', async () => {
    const openai = fakeModel('openai', { text: JSON.stringify(good) });
    const anthropic = fakeModel('anthropic', { text: JSON.stringify(good) });
    const r = await generateInsight({ agent: 'receptionist', rows, chain: [openai.named, anthropic.named] });
    expect(r).toMatchObject({ provider: 'openai', fallbackUsed: false, fallbackReason: null, insight: good });
    expect(anthropic.calls).toHaveLength(0);
    expect(promptText(openai.calls[0])).toContain('receptionist');
  });

  it('falls back to the second provider when the first returns non-JSON', async () => {
    const openai = fakeModel('openai', { text: 'Sure! Here is your insight: ...' });
    const anthropic = fakeModel('anthropic', { text: JSON.stringify(good) });
    const r = await generateInsight({ agent: null, rows, chain: [openai.named, anthropic.named] });
    expect(r).toMatchObject({ provider: 'anthropic', fallbackUsed: true, fallbackReason: 'validation' });
    expect(r.attempts).toEqual([
      expect.objectContaining({ provider: 'openai', ok: false, failure: 'validation' }),
      { provider: 'anthropic', model: 'anthropic-fake', ok: true },
    ]);
  });

  it('falls back when JSON parses but breaks the zod schema', async () => {
    const bad = { ...good, sentiment: 'ecstatic', nextActions: [] };
    const openai = fakeModel('openai', { text: JSON.stringify(bad) });
    const anthropic = fakeModel('anthropic', { text: JSON.stringify(good) });
    const r = await generateInsight({ agent: null, rows, chain: [openai.named, anthropic.named] });
    expect(r.provider).toBe('anthropic');
    expect(r.fallbackReason).toBe('validation');
  });

  it('falls back when the output is schema-valid but cites a record that was not given', async () => {
    const invented = { ...good, missedOpportunities: [{ callOutcomeId: 999, reason: 'made up' }] };
    const openai = fakeModel('anthropic', { text: JSON.stringify(invented) });
    const second = fakeModel('openai', { text: JSON.stringify(good) });
    const r = await generateInsight({ agent: null, rows, chain: [openai.named, second.named] });
    expect(r.provider).toBe('openai');
    expect(r.attempts[0]?.error).toMatch(/unknown callOutcomeId 999/);
  });

  it('falls back on provider errors and labels them provider_error', async () => {
    const err = new APICallError({ message: 'rate limited', url: 'https://x', requestBodyValues: {}, statusCode: 429, isRetryable: false });
    const openai = fakeModel('openai', { error: err });
    const anthropic = fakeModel('anthropic', { text: JSON.stringify(good) });
    const r = await generateInsight({ agent: null, rows, chain: [openai.named, anthropic.named], maxRetries: 0 });
    expect(r).toMatchObject({ provider: 'anthropic', fallbackUsed: true, fallbackReason: 'provider_error' });
  });

  it('throws InsightGenerationError with every attempt when all providers fail', async () => {
    const a = fakeModel('openai', { text: '{}' });
    const b = fakeModel('anthropic', { text: 'nope' });
    const err = await generateInsight({ agent: null, rows, chain: [a.named, b.named] }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InsightGenerationError);
    expect((err as InsightGenerationError).attempts.map((x) => [x.provider, x.failure])).toEqual([
      ['openai', 'validation'],
      ['anthropic', 'validation'],
    ]);
  });

  it('rejects an empty chain', async () => {
    await expect(generateInsight({ agent: null, rows, chain: [] })).rejects.toThrow(/no models/);
  });
});

describe('checkGrounding', () => {
  it('accepts an insight that only references given records', () => {
    expect(() => {
      checkGrounding(good, rows);
    }).not.toThrow();
  });

  it('rejects duplicate ids and inflated counts', () => {
    const dup = { ...good, missedOpportunities: [{ callOutcomeId: 12, reason: 'a' }, { callOutcomeId: 12, reason: 'b' }] };
    expect(() => {
      checkGrounding(dup, rows);
    }).toThrow(/duplicate/);
    const inflated = { ...good, topIntents: [{ intent: 'x', count: 3 }] };
    expect(() => {
      checkGrounding(inflated, rows);
    }).toThrow(/add up to 3/);
  });
});

describe('classifyFailure', () => {
  it('treats grounding errors as validation and anything else as provider_error', () => {
    expect(classifyFailure(new GroundingError('x'))).toBe('validation');
    expect(classifyFailure(new Error('socket hang up'))).toBe('provider_error');
    expect(classifyFailure('weird')).toBe('provider_error');
  });
});
