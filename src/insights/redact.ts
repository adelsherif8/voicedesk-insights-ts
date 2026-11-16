/**
 * Least privilege for the model, ported from VoiceDesk's bedrock.brief_rows(): the model gets
 * intent, outcome and summary, never who called. Emails, phone numbers and the callers' own names
 * (taken from the records) are replaced in free text before anything leaves the process.
 */
export interface BriefRow {
  id: number;
  intent: string;
  outcome: string;
  summary: string;
}

interface RecordLike {
  id: number;
  callerName: string;
  intent: string;
  outcome: string;
  summary: string;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// +1 555 123 4567, (555) 123-4567, 555.123.4567, +44 20 7946 0958 ... at least 7 digits overall
const PHONE = /(?:\+?\d[\d\s().-]{6,}\d)/g;

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createRedactor(names: string[]): (text: string) => string {
  const parts = new Set<string>();
  for (const n of names) {
    const full = n.trim();
    if (!full || /^unknown/i.test(full)) continue;
    parts.add(full);
    for (const p of full.split(/\s+/)) if (p.length >= 3) parts.add(p);
  }
  // longest first so "Sarah Johnson" is replaced before "Sarah"
  const sorted = [...parts].sort((a, b) => b.length - a.length).map(escapeRe);
  const nameRe = sorted.length ? new RegExp(`\\b(?:${sorted.join('|')})\\b`, 'gi') : null;
  return (text: string) => {
    let out = text
      .replace(EMAIL, '[email]')
      .replace(PHONE, (m) => (m.replace(/\D/g, '').length >= 7 ? '[phone]' : m));
    if (nameRe) out = out.replace(nameRe, '[name]');
    return out;
  };
}

export function toBriefRows(records: RecordLike[]): BriefRow[] {
  const redact = createRedactor(records.map((r) => r.callerName));
  return records.map((r) => ({
    id: r.id,
    intent: redact(r.intent),
    outcome: redact(r.outcome),
    summary: redact(r.summary),
  }));
}
