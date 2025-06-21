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

    expect(out.incomes[salaryId].years[0].tax.ni_paid.class1).toEqual(2743);
    expect(out.incomes[salaryId].years[1].tax.ni_paid.class1).toEqual(2811.58);
    expect(out.incomes[salaryId].years[2].tax.ni_paid.class1).toEqual(2881.86);
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

    expect(out.incomes[salaryId].years[0].tax.ni_paid.class1).toEqual(3964.6);
    expect(out.incomes[salaryId].years[1].tax.ni_paid.class1).toEqual(4063.72);
    expect(out.incomes[salaryId].years[2].tax.ni_paid.class1).toEqual(4165.31);
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
      class2: 163.8,
      class4: 3887.6, // 37700 * .09 + 24730 * .02
    });
    expect(incomeResult.years[1].tax.ni_paid).toStrictEqual({
      class2: 167.9,
      class4: 3947.29,
    });
    expect(incomeResult.years[2].tax.ni_paid).toStrictEqual({
      class2: 172.09,
      class4: 4008.47, // 39608.56 * .09 + 22185.08 * .02
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
      class2: 163.8,
      class4: 3887.6, // 37700 * .09 + 24730 * .02
    });
    expect(incomeResult.years[1].tax.ni_paid).toStrictEqual({
      class2: 163.8,
      class4: 3851.01,
    });
    expect(incomeResult.years[2].tax.ni_paid).toStrictEqual({
      class2: 163.8,
      class4: 3815.32,
    });
  });

  test('2 salaries, NICs calculate correctly', () => {
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
    // salary 2: 4818.6 - 2091.6 = 2727 NICs
    expect(out.incomes[salary.id].years[0].tax.ni_paid.class1).toEqual(1743);
    expect(out.incomes[salary2.id].years[1].tax.ni_paid.class1).toEqual(2321.6);
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

    expect(out.incomes[salary.id].years[0].tax.ni_paid.class1).toEqual(1743);
    expect(out.incomes[income2.id].years[0].tax.ni_paid.class2).toEqual(163.8);
    // (50270 - 30000 =) 20270 * .09 = 1824.3
    // (40000 - 20270 =) 19730 * .02 = 394.6
    expect(out.incomes[income2.id].years[0].tax.ni_paid.class4).toEqual(2218.9);
  });
});
