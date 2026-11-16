import type { LanguageModelV4CallOptions, LanguageModelV4GenerateResult } from '@ai-sdk/provider';
import { MockLanguageModelV4 } from 'ai/test';
import type { ProviderName } from '../../src/config.js';
import type { NamedModel } from '../../src/insights/providers.js';

export function textResult(text: string): LanguageModelV4GenerateResult {
  return {
    content: [{ type: 'text', text }],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 20, text: 20, reasoning: 0 },
    },
    warnings: [],
  };
}

/** A fake provider that returns `text` (or throws `error`) and records the prompts it was sent. */
export function fakeModel(provider: ProviderName, opts: { text?: string; error?: Error }) {
  const calls: LanguageModelV4CallOptions[] = [];
  const model = new MockLanguageModelV4({
    provider,
    modelId: `${provider}-fake`,
    doGenerate: async (options) => {
      calls.push(options);
      if (opts.error) throw opts.error;
      return textResult(opts.text ?? '');
    },
  });
  const named: NamedModel = { provider, modelId: model.modelId, model };
  return { named, calls };
}

export const promptText = (call: LanguageModelV4CallOptions | undefined): string => JSON.stringify(call?.prompt ?? []);
