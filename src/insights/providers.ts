import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { AiConfig, ProviderName, RealProvider } from '../config.js';
import { createMockModel } from './mock-model.js';
import type { BriefRow } from './redact.js';

export interface NamedModel {
  provider: ProviderName;
  modelId: string;
  model: LanguageModel;
}

/** Returns the ordered models to try for one request: primary first, then the fallback (if any). */
export type ModelResolver = (rows: BriefRow[]) => NamedModel[];

function realModel(ai: AiConfig, provider: RealProvider): NamedModel {
  if (provider === 'openai') {
    const openai = createOpenAI({ apiKey: ai.openai.apiKey });
    return { provider, modelId: ai.openai.model, model: openai(ai.openai.model) };
  }
  const anthropic = createAnthropic({ apiKey: ai.anthropic.apiKey });
  return { provider, modelId: ai.anthropic.model, model: anthropic(ai.anthropic.model) };
}

export function createModelResolver(ai: AiConfig): ModelResolver {
  if (ai.primary === 'mock') {
    return (rows) => {
      const primary = createMockModel({ rows, invalid: ai.mockPrimaryInvalid });
      const chain: NamedModel[] = [{ provider: 'mock', modelId: primary.modelId, model: primary }];
      if (ai.mockPrimaryInvalid) {
        const fb = createMockModel({ rows, modelId: 'deterministic-fallback' });
        chain.push({ provider: 'mock', modelId: fb.modelId, model: fb });
      }
      return chain;
    };
  }
  // Real providers hold no per-request state, so build them once.
  const chain = [realModel(ai, ai.primary), ...(ai.fallback ? [realModel(ai, ai.fallback)] : [])];
  return () => chain;
}
