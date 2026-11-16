import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';
import { createModelResolver } from '../../src/insights/providers.js';

const rows = [{ id: 1, intent: 'a', outcome: 'Booked', summary: '' }];

describe('createModelResolver', () => {
  it('mock mode: a single deterministic model', () => {
    const chain = createModelResolver(loadConfig({}).ai)(rows);
    expect(chain.map((m) => [m.provider, m.modelId])).toEqual([['mock', 'deterministic-v1']]);
  });

  it('mock mode with MOCK_PRIMARY_INVALID: an invalid primary then a valid mock fallback', () => {
    const chain = createModelResolver(loadConfig({ MOCK_PRIMARY_INVALID: '1' }).ai)(rows);
    expect(chain.map((m) => m.modelId)).toEqual(['deterministic-v1-invalid', 'deterministic-fallback']);
  });

  it('real providers: primary then fallback, built without network calls', () => {
    const ai = loadConfig({ OPENAI_API_KEY: 'sk', ANTHROPIC_API_KEY: 'ak', OPENAI_MODEL: 'gpt-x', ANTHROPIC_MODEL: 'claude-y' }).ai;
    const resolve = createModelResolver(ai);
    const chain = resolve(rows);
    expect(chain.map((m) => [m.provider, m.modelId])).toEqual([
      ['openai', 'gpt-x'],
      ['anthropic', 'claude-y'],
    ]);
    expect(resolve(rows)).toBe(chain);
  });

  it('anthropic only: no fallback', () => {
    const chain = createModelResolver(loadConfig({ ANTHROPIC_API_KEY: 'ak' }).ai)(rows);
    expect(chain.map((m) => m.provider)).toEqual(['anthropic']);
  });
});
