import { round } from 'lodash';
import { v4 } from 'uuid';
import { run } from '../src/calculations';
import { makeCashflow, makeIncome, makePerson } from '../src/factories';
import { iso } from '../src/lib/date';
import {
  ActiveDBPension,
  DeferredDBPension,
  InPaymentDBPension,
} from '../src/types';

describe('defined benefit pensions', () => {
  test('deferred DB produces income at correct time', () => {
    const person = makePerson({ date_of_birth: '1964-06-01' });

    const db: DeferredDBPension = {
      id: v4(),
      owner_id: person.id,
      status: 'deferred',
      annual_amount: 10000,
      deferment_escalation_rate: 0,
      active_escalation_rate: 0,
      normal_retirement_age: 65,
      starts_at: iso('2029-06-01'), // 65th birthday
    };

    const cashflow = makeCashflow({
      people: [person],
      defined_benefits: [db],
      starts_at: iso('2025-06-01'),
      years: 8,
    });

    const out = run(cashflow);

    const inc = cashflow.incomes.find((inc) => inc.source_id === db.id);
    if (!inc) throw new Error('missing income');

    // Expect income to be created in year 4
    const netValues = out.incomes[inc.id].years.map((year) => year.net_value);
    expect(netValues).toEqual([0, 0, 0, 0, 10000, 10000, 10000, 10000]);
  });

  test('deferred DB escalates correctly', () => {
    const person = makePerson({ date_of_birth: '1966-06-01' });

    const db: DeferredDBPension = {
      id: v4(),
      owner_id: person.id,
      status: 'deferred',
      annual_amount: 10000,
      deferment_escalation_rate: 0.03,
      active_escalation_rate: 0.05,
      normal_retirement_age: 65,
      starts_at: iso('2029-06-01'),
    };

    const cashflow = makeCashflow({
      people: [person],
      defined_benefits: [db],
      starts_at: iso('2025-06-01'),
      years: 7,
    });

    const out = run(cashflow);

    const inc = cashflow.incomes.find((inc) => inc.source_id === db.id);
    if (!inc) throw new Error('missing income');

    const netValues = out.incomes[inc.id].years.map((year) => year.net_value);
    const year4value = round(10000 * 1.03 ** 4, 2);

    expect(netValues).toEqual([
      0,
      0,
      0,
      0,
      year4value,
      round(year4value * 1.05, 2),
      round(year4value * 1.05 ** 2, 2),
    ]);
  });

  test('active DB produces correct income at correct time', () => {
    const person = makePerson({ date_of_birth: '1964-06-01' });

    // Salary lasts for 3 years
    const salary = makeIncome({
      type: 'employment',
      people: [person],
      values: [
        {
          value: 50000,
          starts_at: iso('2025-06-01'),
          ends_at: iso('2028-06-01'),
          escalation: 'rpi',
        },
      ],
    });

    const db: ActiveDBPension = {
      id: v4(),
      owner_id: person.id,
      status: 'active',
      linked_salary_id: salary.id,
      deferment_escalation_rate: 0.025,
      active_escalation_rate: 0.03,
      accrual_rate: 1 / 60,
      starts_at: iso('2029-06-01'), // 65th birthday
      normal_retirement_age: 65,
      years_service: 10,
    };

    const cashflow = makeCashflow({
      people: [person],
      incomes: [salary],
      defined_benefits: [db],
      starts_at: iso('2025-06-01'),
      years: 8,
      assumptions: { rpi: 0.03 },
    });

    const out = run(cashflow);

    const inc = cashflow.incomes.find((inc) => inc.source_id === db.id);
    if (!inc) throw new Error('missing income');

    const grossValues = out.incomes[inc.id].years.map(
      (year) => year.gross_value
    );

    // 50k salary, 2 years of escalation at 3%, multiplied by 13 years
    // of service, divided by 60 because it's a 1/60th scheme.
    const finalSalary = 50000 * 1.03 ** 2 * (13 / 60);
    // Add 1 year of deferment growth at 2.5%
    const initialIncome = round(finalSalary * 1.025, 2);

    expect(grossValues).toEqual([
      0,
      0,
      0,
      0,
      initialIncome,
      round(initialIncome * 1.03, 2),
      round(initialIncome * 1.03 ** 2, 2),
      round(initialIncome * 1.03 ** 3, 2),
    ]);
  });

  test('in payment DB has correct values', () => {
    const person = makePerson({ date_of_birth: '1950-02-01' });

    const db: InPaymentDBPension = {
      id: v4(),
      owner_id: person.id,
      status: 'in_payment',
      starts_at: iso('2026-02-01'),
      annual_amount: 15000,
      active_escalation_rate: 'rpi',
    };

    const cashflow = makeCashflow({
      people: [person],
      defined_benefits: [db],
      starts_at: iso('2026-02-01'),
      years: 5,
      assumptions: { rpi: 0.03 },
    });

    const out = run(cashflow);

    const income = cashflow.incomes.find((inc) => inc.source_id === db.id);

    expect(income).not.toBeUndefined();
    if (!income) throw new Error('Missing income');

    const gross = out.incomes[income.id].years.map((y) => y.gross_value);
    expect(gross[0]).toEqual(15000);
    expect(gross[1]).toEqual(15000 * 1.03);
    expect(gross[2]).toEqual(round(15000 * 1.03 ** 2, 2));
    expect(gross[3]).toEqual(round(15000 * 1.03 ** 3, 2));
  });
});
