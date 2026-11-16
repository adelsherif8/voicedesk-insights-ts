import { describe, expect, it } from 'vitest';
import { createRedactor, toBriefRows } from '../../src/insights/redact.js';

describe('createRedactor', () => {
  const redact = createRedactor(['Sarah Johnson', 'Unknown caller', '']);

  it('removes emails and phone numbers', () => {
    expect(redact('mail sarah.j@example.com or call +1 (202) 555-0101')).toBe('mail [email] or call [phone]');
  });

  it('removes the full name and its parts, case-insensitively', () => {
    expect(redact('Sarah Johnson called; later SARAH called back. Johnson family.')).toBe(
      '[name] called; later [name] called back. [name] family.',
    );
  });

  it('keeps short numbers, prices and times', () => {
    expect(redact('Unit B-14, $110, pickup 7:05 PM, party of 8')).toBe('Unit B-14, $110, pickup 7:05 PM, party of 8');
  });

  it('ignores placeholder names like "Unknown caller"', () => {
    expect(redact('Unknown caller hung up')).toBe('Unknown caller hung up');
  });

  it('works with no names at all', () => {
    expect(createRedactor([])('call 202 555 0101')).toBe('call [phone]');
  });
});

describe('toBriefRows', () => {
  it('keeps id/intent/outcome/summary only and redacts every free-text field', () => {
    const rows = toBriefRows([
      { id: 7, callerName: 'Grace Lin', intent: 'Grace wants a showing', outcome: 'Qualified', summary: 'Call Grace at 202-555-0177' },
    ]);
    expect(rows).toEqual([{ id: 7, intent: '[name] wants a showing', outcome: 'Qualified', summary: 'Call [name] at [phone]' }]);
  });
});
