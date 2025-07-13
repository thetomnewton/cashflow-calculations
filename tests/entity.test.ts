import { describe, expect, test } from 'vitest';
import { run } from '../src/calculations';
import { makeCashflow, makePerson } from '../src/factories';
import { iso } from '../src/lib/date';
import { getYearIndexFromDate } from '../src/calculations/entity';

describe('entity helpers', () => {
  test('getYearIndexFromDate handles dates before the cashflow start', () => {
    const person = makePerson({ date_of_birth: '1980-01-01' });
    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2025-04-06'),
      years: 1,
    });
    const output = run(cashflow);
    const idx = getYearIndexFromDate(iso('2024-04-06'), output);
    expect(idx).toBe(-1);
  });

  test('getYearIndexFromDate returns correct positive index', () => {
    const person = makePerson({ date_of_birth: '1980-01-01' });
    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2025-04-06'),
      years: 3,
    });
    const output = run(cashflow);
    const idx = getYearIndexFromDate(iso('2027-04-06'), output);
    expect(idx).toBe(2);
  });
});
