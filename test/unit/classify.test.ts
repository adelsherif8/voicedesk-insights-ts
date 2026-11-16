import { describe, expect, it } from 'vitest';
import { classifyOutcome } from '../../src/insights/classify.js';

describe('classifyOutcome', () => {
  it.each([
    ['Reserved 10x10', 'converted'],
    ['Payment collected', 'converted'],
    ['Order to kitchen · $47.00', 'converted'],
    ['Qualified · routed to listing agent', 'converted'],
    ['Recall booked', 'converted'],
    ['Resolved by phone', 'converted'],
    ['Follow-up sent', 'open'],
    ['Not now · nurture', 'open'],
    ['Pending · offered alternatives', 'open'],
    ['Missed · text-back sending', 'open'],
    ['Transferred to human', 'open'],
    ['Nurture · not pre-approved', 'open'],
    ['Answered · FAQ', 'informational'],
    ['call logged', 'informational'],
  ])('%s -> %s', (outcome, expected) => {
    expect(classifyOutcome(outcome)).toBe(expected);
  });
});
