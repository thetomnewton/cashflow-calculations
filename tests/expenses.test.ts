import { round } from 'lodash';
import { describe, expect, test } from 'vitest';
import { run } from '../src/calculations';
import {
  makeAccount,
  makeCashflow,
  makeExpense,
  makeIncome,
  makeMoneyPurchase,
  makePerson,
} from '../src/factories';
import { iso } from '../src/lib/date';
import { Account } from '../src/types';

describe('expenses', () => {
  test('income surplus added to sweep', () => {
    const person = makePerson({ date_of_birth: '1965-06-09' });

    const salary = makeIncome({
      type: 'employment',
      people: [person],
      values: [
        {
          value: 30000,
          starts_at: iso('2025-12-20'),
          ends_at: iso('2027-12-20'),
          escalation: 'cpi',
        },
      ],
    });

    const costs = makeExpense({
      values: [
        {
          value: 15000,
          starts_at: iso('2025-12-20'),
          ends_at: iso('2027-12-20'),
          escalation: 'cpi',
        },
      ],
    });

    const cashflow = makeCashflow({
      people: [person],
      incomes: [salary],
      expenses: [costs],
      assumptions: { windfall_save: 'sweep' },
      starts_at: iso('2025-06-04'),
    });

    const out = run(cashflow);

    expect(out.incomes[salary.id].years[0].net_value).toBe(25119.6);
    expect(out.expenses[costs.id].years[0].value).toEqual(15000);

    const sweep = cashflow.accounts.find((acc) => acc.is_sweep);
    expect(out.accounts[(sweep as Account).id].years[0].current_value).toBe(
      round(25119.6 - 15000, 2)
    );
  });

  test('income surplus discarded', () => {
    const person = makePerson({ date_of_birth: '1965-06-09' });

    const salary = makeIncome({
      type: 'employment',
      people: [person],
      values: [
        {
          value: 30000,
          starts_at: iso('2025-12-20'),
          ends_at: iso('2027-12-20'),
          escalation: 'cpi',
        },
      ],
    });

    const costs = makeExpense({
      values: [
        {
          value: 15000,
          starts_at: iso('2025-12-20'),
          ends_at: iso('2027-12-20'),
          escalation: 'cpi',
        },
      ],
    });

    const cashflow = makeCashflow({
      people: [person],
      incomes: [salary],
      expenses: [costs],
      starts_at: iso('2025-06-04'),
      assumptions: { windfall_save: 'discard' },
    });

    const out = run(cashflow);

    expect(out.incomes[salary.id].years[0].net_value).toBe(25119.6);
    expect(out.expenses[costs.id].years[0].value).toEqual(15000);

    const sweep = cashflow.accounts.find((acc) => acc.is_sweep);
    expect(out.accounts[(sweep as Account).id].years[0].current_value).toBe(0);
  });

  test('simple shortfall handled', () => {
    /**
     * 55k salary/year, 75k expenses/year, 100k in isa, 2 year cashflow
     * isa covers shortfall, sweep account remains at 0
     */
    const person = makePerson({ date_of_birth: '1980-04-04' });

    const salary = makeIncome({
      type: 'employment',
      people: [person],
      values: [
        {
          value: 55000,
          starts_at: iso('2025-12-20'),
          ends_at: iso('2027-12-20'),
          escalation: 'rpi',
        },
      ],
    });

    const costs = makeExpense({
      values: [
        {
          value: 75000,
          starts_at: iso('2025-12-20'),
          ends_at: iso('2027-12-20'),
          escalation: 'cpi',
        },
      ],
    });

    const isa = makeAccount({
      category: 'isa',
      owner_id: person.id,
      valuations: [{ value: 100000, date: iso('2025-12-20') }],
      growth_template: { type: 'flat', rate: { gross_rate: 0.03, charges: 0 } },
    });

    const cashflow = makeCashflow({
      people: [person],
      incomes: [salary],
      expenses: [costs],
      accounts: [isa],
      starts_at: iso('2025-06-04'),
    });
    const out = run(cashflow);

    const sweep = cashflow.accounts.find((acc) => acc.is_sweep);

    expect(out.accounts[(sweep as Account).id].years[0]).toEqual({
      start_value: 0,
      current_value: 0,
      end_value: 0,
      net_growth: 0.005,
    });

    expect(out.incomes[salary.id].years[0].net_value).toEqual(42457.4);

    expect(out.accounts[isa.id].years[0]).toEqual({
      start_value: 100000,
      net_growth: 0.03,
      current_value: round(100000 - (75000 - 42457.4), 2),
      end_value: 69481.12,
    });
  });

  test('simple shortfall handled, pension, no tax', () => {
    /**
     * 5k salary/year, 7k expenses/year, 50k in DC pension, 3 year cashflow
     * pension covers shortfall, sweep account remains at 0
     */
    const person = makePerson({ date_of_birth: '1980-04-04' });

    const salary = makeIncome({
      type: 'employment',
      people: [person],
      values: [
        {
          value: 5000,
          starts_at: iso('2025-12-20'),
          ends_at: iso('2027-12-20'),
          escalation: 'rpi',
        },
      ],
    });

    const costs = makeExpense({
      values: [
        {
          value: 7000,
          starts_at: iso('2025-12-20'),
          ends_at: iso('2027-12-20'),
          escalation: 'cpi',
        },
      ],
    });

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          value: 50000,
          uncrystallised_value: 50000,
          crystallised_value: 0,
          date: iso('2025-12-20'),
        },
      ],
      growth_template: { type: 'flat', rate: { gross_rate: 0.03, charges: 0 } },
    });

    const cashflow = makeCashflow({
      people: [person],
      incomes: [salary],
      expenses: [costs],
      money_purchases: [pension],
      starts_at: iso('2025-06-04'),
    });
    const out = run(cashflow);

    const sweep = cashflow.accounts.find((acc) => acc.is_sweep);

    expect(out.accounts[(sweep as Account).id].years[0]).toEqual({
      start_value: 0,
      current_value: 0,
      end_value: 0,
      net_growth: 0.005,
    });

    expect(out.incomes[salary.id].years[0].net_value).toEqual(5000);

    const pensionOut = out.money_purchases[pension.id].years[0];

    expect(pensionOut.start_value).toEqual(50000);
    expect(pensionOut.start_value_uncrystallised).toEqual(50000);
    expect(pensionOut.start_value_crystallised).toEqual(0);
    expect(round(pensionOut.current_value ?? 0)).toEqual(48000);
    expect(round(pensionOut.current_value_uncrystallised ?? 0)).toEqual(48000);
    expect(pensionOut.current_value_crystallised).toEqual(0);
    expect(round(pensionOut.end_value ?? 0)).toEqual(48000 * 1.03);
    expect(round(pensionOut.end_value_uncrystallised ?? 0)).toEqual(
      48000 * 1.03
    );
    expect(pensionOut.end_value_crystallised).toEqual(0);
    expect(pensionOut.net_growth).toEqual(0.03);
  });

  test('unresolved shortfall takes sweep to overdraft', () => {
    const person = makePerson({ date_of_birth: '1985-01-01' });

    const salary = makeIncome({
      type: 'employment',
      people: [person],
      values: [
        {
          value: 10000,
          starts_at: iso('2025-12-20'),
          ends_at: iso('2027-12-20'),
          escalation: 0,
        },
      ],
    });

    const expense = makeExpense({
      people: [person],
      values: [
        {
          value: 12000,
          starts_at: iso('2025-12-20'),
          ends_at: iso('2027-12-20'),
          escalation: 'cpi',
        },
      ],
    });

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2025-12-20'),
      years: 5,
      incomes: [salary],
      expenses: [expense],
    });

    const out = run(cashflow);

    const sweep = cashflow.accounts.find((acc) => acc.is_sweep);
    expect(out.accounts[(sweep as Account).id].years[0]).toEqual({
      start_value: 0,
      current_value: -2000,
      net_growth: 0.005,
      end_value: -2000,
    });
  });

  test('liquidation order by tax category sorts correctly', () => {
    const person = makePerson({ date_of_birth: '1985-01-01' });

    const expense = makeExpense({
      people: [person],
      values: [
        {
          value: 20000,
          starts_at: iso('2025-12-20'),
          ends_at: iso('2037-12-20'),
          escalation: 0,
        },
      ],
    });

    const cash = makeAccount({
      category: 'cash',
      owner_id: person.id,
      valuations: [{ value: 30000, date: iso('2025-12-20') }],
      growth_template: {
        type: 'flat',
        rate: { gross_rate: 0, charges: 0 },
      },
    });

    const isa = makeAccount({
      category: 'isa',
      owner_id: person.id,
      valuations: [{ value: 30000, date: iso('2025-12-20') }],
      growth_template: {
        type: 'flat',
        rate: { gross_rate: 0, charges: 0 },
      },
    });

    const gia = makeAccount({
      category: 'unwrapped',
      sub_category: 'gia',
      owner_id: person.id,
      valuations: [{ value: 30000, date: iso('2025-12-20') }],
      growth_template: {
        type: 'flat',
        rate: { gross_rate: 0, charges: 0 },
      },
    });

    const bonds = makeAccount({
      category: 'bond',
      owner_id: person.id,
      valuations: [{ value: 30000, date: iso('2025-12-20') }],
      growth_template: {
        type: 'flat',
        rate: { gross_rate: 0, charges: 0 },
      },
    });

    const sipp = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          value: 30000,
          uncrystallised_value: 30000,
          crystallised_value: 0,
          date: iso('2025-12-20'),
        },
      ],
      growth_template: { type: 'flat', rate: { gross_rate: 0, charges: 0 } },
    });

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2025-12-20'),
      years: 10,
      accounts: [isa, gia, cash, bonds],
      money_purchases: [sipp],
      expenses: [expense],
      assumptions: {
        liquidation_strategy: 'taxation',
      },
    });

    const out = run(cashflow);

    const accts = out.accounts;
    const pens = out.money_purchases;

    expect(round(accts[cash.id].years[0].end_value as number)).toEqual(10000);
    expect(round(accts[cash.id].years[1].end_value as number)).toEqual(0);

    expect(round(accts[gia.id].years[0].end_value as number)).toEqual(30000);
    expect(round(accts[gia.id].years[1].end_value as number)).toEqual(20000);
    expect(round(accts[gia.id].years[2].end_value as number)).toEqual(0);

    expect(round(accts[bonds.id].years[2].end_value as number)).toEqual(30000);
    expect(round(accts[bonds.id].years[3].end_value as number)).toEqual(10000);
    expect(round(accts[bonds.id].years[4].end_value as number)).toEqual(0);

    expect(round(accts[isa.id].years[3].end_value as number)).toEqual(30000);
    expect(round(accts[isa.id].years[4].end_value as number)).toEqual(20000);
    expect(round(accts[isa.id].years[5].end_value as number)).toEqual(0);

    expect(round(pens[sipp.id].years[5].end_value as number)).toEqual(30000);
    expect(round(pens[sipp.id].years[6].end_value as number)).toBeGreaterThan(
      9000
    );
    expect(round(pens[sipp.id].years[6].end_value as number)).toBeLessThan(
      10000
    );
    expect(round(pens[sipp.id].years[7].end_value as number)).toEqual(0);

    const sweep = cashflow.accounts.find((acc) => acc.is_sweep);
    expect(accts[(sweep as Account).id].years[7].end_value).toBeLessThan(
      -10000
    );
  });

  test('custom liquidation order works correctly', () => {
    const person = makePerson({ date_of_birth: '1985-01-01' });

    const expense = makeExpense({
      people: [person],
      values: [
        {
          value: 60000,
          starts_at: iso('2025-12-20'),
          ends_at: iso('2027-12-20'),
          escalation: 'cpi',
        },
      ],
    });

    const isa1 = makeAccount({
      category: 'isa',
      owner_id: person.id,
      valuations: [{ value: 40000, date: iso('2025-12-20') }],
      growth_template: { type: 'flat', rate: { gross_rate: 0.03, charges: 0 } },
    });

    const isa2 = makeAccount({
      category: 'isa',
      owner_id: person.id,
      valuations: [{ value: 40000, date: iso('2025-12-20') }],
      growth_template: { type: 'flat', rate: { gross_rate: 0.03, charges: 0 } },
    });

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2025-12-20'),
      years: 5,
      accounts: [isa1, isa2],
      expenses: [expense],
      assumptions: {
        liquidation_strategy: 'custom',
        custom_liquidation_order: [isa2.id, isa1.id],
      },
    });

    const out = run(cashflow);

    expect(out.accounts[isa2.id].years[0].end_value).toEqual(0);
    expect(out.accounts[isa1.id].years[0].end_value).toEqual(20600);
  });
});
