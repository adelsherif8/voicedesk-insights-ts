/**
 * Outcome buckets. `converted` ports the "booked" counter from VoiceDesk's db.stats()
 * (outcome LIKE book/reserv/order/qualif) plus a few closed-won words from the seed data.
 * `open` is a call that ended without the business getting what it wanted yet.
 */
export type OutcomeClass = 'converted' | 'open' | 'informational';

const CONVERTED = /book|reserv|order|qualif|confirm|collected|paid|resolved|restored|reactivated|deposit/i;
const OPEN =
  /follow-?up|nurture|missed|voicemail|retry|not now|hang-?up|transfer|awaiting|deciding|pending|texted|no answer|not pre-approved/i;

export function classifyOutcome(outcome: string): OutcomeClass {
  // "open" is checked first: "Pending - offered alternatives" or "Not now - nurture" should never count as won.
  if (OPEN.test(outcome)) return 'open';
  if (CONVERTED.test(outcome)) return 'converted';
  return 'informational';
}
