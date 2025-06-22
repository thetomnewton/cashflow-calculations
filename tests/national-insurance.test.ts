import { round } from 'lodash';
import { v4 } from 'uuid';
import { describe, expect, test } from 'vitest';
import { run } from '../src/calculations';
import { makeCashflow, makeIncome, makePerson } from '../src/factories';
import { iso } from '../src/lib/date';

describe('national insurance', () => {
  test('salary below threshold has no NICs to pay', () => {
    const person = makePerson({ date_of_birth: '1980-01-01', sex: 'male' });
    const salary = makeIncome({
      id: v4(),
      type: 'employment',
      people: [person],
      values: [
        {
          value: 10000,
          starts_at: iso('2025-08-13'),
          ends_at: iso('2028-08-13'),
          adjusted: true,
          escalation: 'cpi',
        },
      ],
    });
    const cashflow = makeCashflow({
      starts_at: iso('2025-08-13'),
      years: 3,
      people: [person],
      incomes: [salary],
    });

    const out = run(cashflow);

    expect(out.incomes[salary.id].years[0].tax.ni_paid.class1).toEqual(0);
    expect(out.incomes[salary.id].years[1].tax.ni_paid.class1).toEqual(0);
    expect(out.incomes[salary.id].years[2].tax.ni_paid.class1).toEqual(0);
  });

  test('under 16 no NICs', () => {
    const person = makePerson({ date_of_birth: '2020-01-01', sex: 'male' });
    const salary = makeIncome({
      id: v4(),
      type: 'employment',
      people: [person],
      values: [
        {
          value: 20000,
          starts_at: iso('2025-08-13'),
          ends_at: iso('2028-08-13'),
          adjusted: true,
          escalation: 'cpi',
        },
      ],
    });
    const cashflow = makeCashflow({
      starts_at: iso('2025-08-13'),
      years: 3,
      people: [person],
      incomes: [salary],
    });

    const out = run(cashflow);

    expect(out.incomes[salary.id].years[0].tax.ni_paid).toStrictEqual({});
    expect(out.incomes[salary.id].years[1].tax.ni_paid).toStrictEqual({});
    expect(out.incomes[salary.id].years[2].tax.ni_paid).toStrictEqual({});
  });

  test('over state pension age no NICs', () => {
    const person = makePerson({ date_of_birth: '1933-01-01', sex: 'male' });
    const salaryId = v4();
    const cashflow = makeCashflow({
      starts_at: iso('2025-08-13'),
      years: 3,
      people: [person],
      incomes: [
        makeIncome({
          id: salaryId,
          type: 'employment',
          people: [person],
          values: [
            {
              value: 50000,
              starts_at: iso('2025-08-13'),
              ends_at: iso('2028-08-13'),
              adjusted: true,
              escalation: 'cpi',
            },
          ],
        }),
      ],
    });

    const out = run(cashflow);

    expect(out.incomes[salaryId].years[0].tax.ni_paid).toStrictEqual({});
    expect(out.incomes[salaryId].years[1].tax.ni_paid).toStrictEqual({});
    expect(out.incomes[salaryId].years[2].tax.ni_paid).toStrictEqual({});
  });

  test('salary above LPL taxed via class1', () => {
    const person = makePerson({ date_of_birth: '1980-07-30', sex: 'female' });
    const salaryId = v4();
    const cashflow = makeCashflow({
      starts_at: iso('2025-08-13'),
      years: 3,
      people: [person],
      incomes: [
        makeIncome({
          id: salaryId,
          type: 'employment',
          people: [person],
          values: [
            {
              value: 40000,
              starts_at: iso('2025-08-13'),
              ends_at: iso('2028-08-13'),
              adjusted: true,
              escalation: 'cpi',
            },
          ],
        }),
      ],
    });

    const out = run(cashflow);

    expect(out.incomes[salaryId].years[0].tax.ni_paid.class1).toEqual(2194.4);
    expect(out.incomes[salaryId].years[1].tax.ni_paid.class1).toEqual(2249.26);
    expect(out.incomes[salaryId].years[2].tax.ni_paid.class1).toEqual(2305.49);
  });

  test('salary above UPL taxed appropriately with class1', () => {
    const person = makePerson({ date_of_birth: '1965-10-10', sex: 'male' });
    const salaryId = v4();
    const cashflow = makeCashflow({
      starts_at: iso('2025-08-13'),
      years: 3,
      people: [person],
      incomes: [
        makeIncome({
          id: salaryId,
          type: 'employment',
          people: [person],
          values: [
            {
              value: 60000,
              starts_at: iso('2025-08-13'),
              ends_at: iso('2028-08-13'),
              adjusted: true,
              escalation: 'cpi',
            },
          ],
        }),
      ],
    });

    const out = run(cashflow);

    // 37700 * .08 + 9730 * .02
    expect(out.incomes[salaryId].years[0].tax.ni_paid.class1).toEqual(3210.6);

    // 38642.5 * .08 + 9973.25 * .02
    expect(out.incomes[salaryId].years[1].tax.ni_paid.class1).toEqual(3290.87);

    // 39608.56 * .08 + 10222.58 * .02
    expect(out.incomes[salaryId].years[2].tax.ni_paid.class1).toEqual(3373.14);
  });

  test('self-employed pays correct class2 and class4 NICs', () => {
    const person = makePerson({ date_of_birth: '1991-09-01', sex: 'female' });
    const income = makeIncome({
      id: v4(),
      type: 'self_employment',
      people: [person],
      values: [
        {
          value: 75000,
          starts_at: iso('2025-08-13'),
          ends_at: iso('2028-08-13'),
          escalation: 0,
        },
      ],
    });

    const cashflow = makeCashflow({
      starts_at: iso('2025-08-13'),
      years: 3,
      people: [person],
      incomes: [income],
    });

    const out = run(cashflow);
    const incomeResult = out.incomes[income.id];

    expect(incomeResult.years[0].tax.ni_paid).toStrictEqual({
      class2: 182,
      class4: 2756.6, // 37700 * .06 + 24730 * .02
    });
    expect(incomeResult.years[1].tax.ni_paid).toStrictEqual({
      class2: 186.55,
      class4: 2788.02,
    });
    expect(incomeResult.years[2].tax.ni_paid).toStrictEqual({
      class2: 191.21,
      class4: 2820.22, // 39608.56 * .06 + 22185.08 * .02
    });
  });

  test('NIC thresholds project forward (real terms)', () => {
    const person = makePerson({ date_of_birth: '1991-09-01', sex: 'female' });
    const income = makeIncome({
      id: v4(),
      type: 'self_employment',
      people: [person],
      values: [
        {
          value: 75000,
          starts_at: iso('2025-08-13'),
          ends_at: iso('2028-08-13'),
          escalation: 0,
        },
      ],
    });

    const cashflow = makeCashflow({
      starts_at: iso('2025-08-13'),
      years: 3,
      people: [person],
      incomes: [income],
      assumptions: { terms: 'real' },
    });

    const out = run(cashflow);
    const incomeResult = out.incomes[income.id];

    expect(incomeResult.years[0].tax.ni_paid).toStrictEqual({
      class2: 182,
      class4: 2756.6, // 37700 * .06 + 24730 * .02
    });
    expect(incomeResult.years[1].tax.ni_paid).toStrictEqual({
      class2: 182,
      class4: 2720.01,
    });
    expect(incomeResult.years[2].tax.ni_paid).toStrictEqual({
      class2: 182,
      class4: 2684.32,
    });
  });

  test('2 PAYE salaries, NICs calculate correctly', () => {
    const person = makePerson({ date_of_birth: '1991-09-01', sex: 'female' });
    const salary = makeIncome({
      id: v4(),
      type: 'employment',
      people: [person],
      values: [
        {
          value: 30000,
          starts_at: iso('2025-08-13'),
          ends_at: iso('2028-08-13'),
          adjusted: true,
          escalation: 'cpi',
        },
      ],
    });

    const salary2 = makeIncome({
      id: v4(),
      type: 'employment',
      people: [person],
      values: [
        {
          value: 35000,
          starts_at: iso('2025-08-13'),
          ends_at: iso('2028-08-13'),
          adjusted: true,
          escalation: 'cpi',
        },
      ],
    });

    const cashflow = makeCashflow({
      starts_at: iso('2025-08-13'),
      years: 3,
      people: [person],
      incomes: [salary, salary2],
      assumptions: { terms: 'real' },
    });

    const out = run(cashflow);

    // salary 1 should use up much of the thresholds, salary 2 uses the remainder
    // (30000 - 12570) * 0.08 = 1394.4 for salary1
    // 50270 - 30000 = 20270 left of UPL
    // (20270 * .08 + 14730 * .02) = 1916.2
    expect(out.incomes[salary.id].years[0].tax.ni_paid.class1).toEqual(1394.4);
    expect(out.incomes[salary2.id].years[1].tax.ni_paid.class1).toEqual(1916.2);
  });

  test('2 incomes, NICs calculate correctly', () => {
    const person = makePerson({ date_of_birth: '1985-03-01', sex: 'male' });

    const salary = makeIncome({
      id: v4(),
      type: 'employment',
      people: [person],
      values: [
        {
          value: 30000,
          starts_at: iso('2025-08-13'),
          ends_at: iso('2028-08-13'),
          adjusted: true,
          escalation: 'cpi',
        },
      ],
    });

    const income2 = makeIncome({
      id: v4(),
      type: 'self_employment',
      people: [person],
      values: [
        {
          value: 40000,
          starts_at: iso('2025-08-13'),
          ends_at: iso('2028-08-13'),
          escalation: 0,
        },
      ],
    });

    const cashflow = makeCashflow({
      starts_at: iso('2025-08-13'),
      years: 3,
      people: [person],
      incomes: [salary, income2],
      assumptions: { terms: 'real' },
    });

    const out = run(cashflow);

    expect(out.incomes[salary.id].years[0].tax.ni_paid.class1).toEqual(
      (30_000 - 12_570) * 0.08
    );
    expect(out.incomes[income2.id].years[0].tax.ni_paid.class2).toEqual(182);

    // (50270 - 30000 =) 20270 * .06 = 1216.2
    // (40000 - 20270 =) 19730 * .02 = 394.6
    expect(out.incomes[income2.id].years[0].tax.ni_paid.class4).toEqual(
      round(1216.2 + 394.6, 2)
    );
  });
});
