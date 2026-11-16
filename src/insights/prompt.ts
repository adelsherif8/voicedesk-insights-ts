import type { BriefRow } from './redact.js';

export const SYSTEM_PROMPT =
  'You are an operations analyst for a small business that uses an AI phone agent. ' +
  'You only use the call records you are given. You never invent calls, counts or ids.';

export function buildPrompt(agent: string | null, rows: BriefRow[]): string {
  const who = agent ? `the "${agent}" phone agent` : 'all phone agents';
  return [
    `Here are the ${rows.length} most relevant call records for ${who}, as JSON.`,
    'Caller names, phone numbers and emails have been removed.',
    '<records>',
    JSON.stringify(rows),
    '</records>',
    'Return a structured insight for the business owner:',
    '- summary: two or three plain sentences.',
    '- topIntents: up to 5 intent labels with how many of these records had each; counts must not exceed the number of records.',
    '- missedOpportunities: calls that ended without a booking, sale or resolution, referenced by their record id.',
    '- nextActions: up to 5 concrete actions, each with a priority.',
    '- sentiment: overall caller sentiment.',
  ].join('\n');
}
