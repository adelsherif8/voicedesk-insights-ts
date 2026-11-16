import { OpenTelemetry } from '@ai-sdk/otel';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { generateText, JSONParseError, NoObjectGeneratedError, Output, TypeValidationError } from 'ai';
import type { ProviderName } from '../config.js';
import { buildPrompt, SYSTEM_PROMPT } from './prompt.js';
import type { NamedModel } from './providers.js';
import type { BriefRow } from './redact.js';
import { type Insight, InsightSchema } from './schema.js';


export type FailureKind = 'validation' | 'provider_error';

export interface Attempt {
  provider: ProviderName;
  model: string;
  ok: boolean;
  failure?: FailureKind;
  error?: string;
}

export interface InsightResult {
  insight: Insight;
  provider: ProviderName;
  model: string;
  fallbackUsed: boolean;
  fallbackReason: FailureKind | null;
  attempts: Attempt[];
}

/** Output that parsed and matched the schema but is not true to the input records. */
export class GroundingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GroundingError';
  }
}

export class InsightGenerationError extends Error {
  constructor(readonly attempts: Attempt[]) {
    super(`all ${attempts.length} provider attempt(s) failed`);
    this.name = 'InsightGenerationError';
  }
}

/** Schema validation can't see the input, so check the references against it here. */
export function checkGrounding(insight: Insight, rows: BriefRow[]): void {
  const ids = new Set(rows.map((r) => r.id));
  const seen = new Set<number>();
  for (const m of insight.missedOpportunities) {
    if (!ids.has(m.callOutcomeId)) throw new GroundingError(`unknown callOutcomeId ${m.callOutcomeId}`);
    if (seen.has(m.callOutcomeId)) throw new GroundingError(`duplicate callOutcomeId ${m.callOutcomeId}`);
    seen.add(m.callOutcomeId);
  }
  const total = insight.topIntents.reduce((s, t) => s + t.count, 0);
  if (total > rows.length) {
    throw new GroundingError(`intent counts add up to ${total} but only ${rows.length} records were given`);
  }
}

export function classifyFailure(err: unknown): FailureKind {
  if (
    NoObjectGeneratedError.isInstance(err) ||
    TypeValidationError.isInstance(err) ||
    JSONParseError.isInstance(err) ||
    err instanceof GroundingError
  ) {
    return 'validation';
  }
  return 'provider_error';
}

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err)).slice(0, 300);

export interface GenerateInsightInput {
  agent: string | null;
  rows: BriefRow[];
  chain: NamedModel[];
  maxRetries?: number;
}

/**
 * Tries each model in order. A model's answer is accepted only if it parses, matches InsightSchema
 * and passes the grounding check; otherwise the next model (the fallback provider) is tried.
 */
export async function generateInsight({ agent, rows, chain, maxRetries = 1 }: GenerateInsightInput): Promise<InsightResult> {
  if (chain.length === 0) throw new Error('no models configured');
  const prompt = buildPrompt(agent, rows);
  const attempts: Attempt[] = [];
  // looked up per call so a provider registered after import (or re-registered) is always used
  const tracer = trace.getTracer('voicedesk-insights');
  // bridges AI SDK lifecycle events (model call, tokens, finish reason) to the same tracer provider
  const aiTelemetry = new OpenTelemetry();

  for (const [index, m] of chain.entries()) {
    const outcome = await tracer.startActiveSpan('insight.attempt', async (span) => {
      span.setAttributes({
        'insight.provider': m.provider,
        'insight.model': m.modelId,
        'insight.attempt': index + 1,
        'insight.records': rows.length,
      });
      try {
        const result = await generateText({
          model: m.model,
          instructions: SYSTEM_PROMPT,
          prompt,
          output: Output.object({ schema: InsightSchema, name: 'call_insight' }),
          temperature: 0.2,
          maxRetries,
          telemetry: { integrations: [aiTelemetry], functionId: 'call-insight', recordInputs: false },
        });
        const insight = result.output;
        checkGrounding(insight, rows);
        span.setStatus({ code: SpanStatusCode.OK });
        return { ok: true as const, insight };
      } catch (err) {
        const failure = classifyFailure(err);
        span.setAttribute('insight.failure', failure);
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        span.setStatus({ code: SpanStatusCode.ERROR, message: failure });
        return { ok: false as const, failure, error: errorMessage(err) };
      } finally {
        span.end();
      }
    });

    if (outcome.ok) {
      attempts.push({ provider: m.provider, model: m.modelId, ok: true });
      const firstFailure = attempts.find((a) => !a.ok)?.failure ?? null;
      return {
        insight: outcome.insight,
        provider: m.provider,
        model: m.modelId,
        fallbackUsed: index > 0,
        fallbackReason: index > 0 ? firstFailure : null,
        attempts,
      };
    }
    attempts.push({ provider: m.provider, model: m.modelId, ok: false, failure: outcome.failure, error: outcome.error });
  }
  throw new InsightGenerationError(attempts);
}
