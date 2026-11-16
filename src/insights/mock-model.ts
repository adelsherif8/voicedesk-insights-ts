import type { LanguageModelV4, LanguageModelV4GenerateResult } from '@ai-sdk/provider';
import { classifyOutcome } from './classify.js';
import type { BriefRow } from './redact.js';
import type { Insight } from './schema.js';

/**
 * MOCK mode. A real AI SDK LanguageModelV4 that never calls the network: it computes the insight
 * with plain rules from the records it was built with and returns it as JSON text, so the request
 * still goes through generateText + Output.object + zod validation exactly like a real provider.
 */

const intentLabel = (intent: string): string =>
  (intent.split(/[·—:]/)[0] ?? intent).trim().toLowerCase() || 'unspecified';

export function heuristicInsight(rows: BriefRow[]): Insight {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(intentLabel(r.intent), (counts.get(intentLabel(r.intent)) ?? 0) + 1);
  const topIntents = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([intent, count]) => ({ intent, count }));

  const classes = rows.map((r) => ({ row: r, cls: classifyOutcome(r.outcome) }));
  const open = classes.filter((c) => c.cls === 'open');
  const converted = classes.filter((c) => c.cls === 'converted').length;
  const informational = rows.length - open.length - converted;

  const missedOpportunities = open.slice(0, 10).map(({ row }) => ({
    callOutcomeId: row.id,
    reason: `Ended as "${row.outcome}" with no booking, sale or resolution yet.`,
  }));

  const nextActions: Insight['nextActions'] = [];
  if (open.length > 0) {
    nextActions.push({
      action: `Follow up on ${open.length} open call(s): ids ${open
        .slice(0, 10)
        .map((c) => c.row.id)
        .join(', ')}.`,
      priority: 'high',
    });
  }
  const top = topIntents[0];
  if (top) {
    nextActions.push({
      action: `Check the agent's script and FAQ for the most common intent ("${top.intent}", ${top.count} call(s)).`,
      priority: 'medium',
    });
  }
  nextActions.push({ action: 'Re-run this insight after the next batch of calls to compare.', priority: 'low' });

  const total = rows.length || 1;
  const sentiment: Insight['sentiment'] =
    converted / total >= 0.6
      ? 'positive'
      : open.length / total >= 0.5
        ? 'negative'
        : converted > 0 && open.length > 0
          ? 'mixed'
          : 'neutral';

  const summary =
    `${rows.length} call(s) analysed: ${converted} converted, ${open.length} still open, ${informational} informational.` +
    (top ? ` Most common intent: "${top.intent}".` : '');

  return { summary, topIntents, missedOpportunities, nextActions, sentiment };
}

export interface MockModelOptions {
  rows: BriefRow[];
  /** return output that fails the schema, to exercise the fallback path offline */
  invalid?: boolean;
  modelId?: string;
}

export function createMockModel({ rows, invalid = false, modelId = 'deterministic-v1' }: MockModelOptions): LanguageModelV4 {
  const text = invalid
    ? JSON.stringify({ summary: '', topIntents: [], sentiment: 'great' })
    : JSON.stringify(heuristicInsight(rows));
  const result: LanguageModelV4GenerateResult = {
    content: [{ type: 'text', text }],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: {
      inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 0, text: 0, reasoning: 0 },
    },
    warnings: [],
  };
  return {
    specificationVersion: 'v4',
    provider: 'mock',
    modelId: invalid ? `${modelId}-invalid` : modelId,
    supportedUrls: {},
    doGenerate: () => Promise.resolve(result),
    doStream: () => Promise.reject(new Error('mock model does not stream')),
  };
}
