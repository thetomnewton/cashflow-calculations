import { round } from 'lodash';
import { run } from '../src/calculations';
import { isAccount } from '../src/calculations/accounts';
import { applyGrowth } from '../src/calculations/growth';
import {
  makeAccount,
  makeCashflow,
  makeIncome,
  makeMoneyPurchase,
  makePerson,
} from '../src/factories';
import { iso } from '../src/lib/date';

describe('contributions', () => {
  test('can make a personal contribution to a cash account', () => {
    const person = makePerson({ date_of_birth: '1985-01-01' });

    const cash1 = makeAccount({
      category: 'cash',
      owner_id: person.id,
      valuations: [{ date: iso(), value: 1000 }],
      growth_template: { type: 'flat', rate: { gross_rate: 0.05, charges: 0 } },
      contributions: [
        {
          type: 'personal',
          value: 1000,
          starts_at: iso(),
          ends_at: iso('2025-04-06'),
          escalation: 'cpi',
        },
      ],
    });

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2025-04-06'),
      years: 1,
      accounts: [cash1],
    });
    const output = run(cashflow);

    expect(output.accounts[cash1.id].years[0].end_value).toEqual(2100);

    const sweep = cashflow.accounts.find(
      (acc) => isAccount(acc) && acc.is_sweep
    );
    expect(output.accounts[sweep?.id as string].years[0].end_value).toEqual(
      -1000
    );
  });

  test('personal contribution to money purchase is grossed up', () => {
    const person = makePerson({ date_of_birth: '1985-01-01' });

    const salary = makeIncome({
      people: [person],
      values: [
        {
          value: 15000,
          starts_at: iso('2025-09-30'),
          ends_at: iso('2030-09-30'),
          escalation: 'cpi',
        },
      ],
    });

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          date: iso('2025-09-30'),
          value: 10000,
          uncrystallised_value: 10000,
          crystallised_value: 0,
        },
      ],
      growth_template: { type: 'flat', rate: { gross_rate: 0.05, charges: 0 } },
      contributions: [
        {
          type: 'personal',
          value: 2000,
          starts_at: iso('2025-09-30'),
          ends_at: iso('2027-09-30'),
          escalation: 0,
        },
      ],
    });

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2025-09-30'),
      years: 2,
      money_purchases: [pension],
      incomes: [salary],
    });

    const output = run(cashflow);
    const [year0, year1] = output.money_purchases[pension.id].years;

    expect(year0).toEqual({
      start_value: 10000,
      current_value: 12500, // 2000 contribution grossed-up to 2500
      end_value: 13125,
      net_growth: 0.05,

      current_value_crystallised: 0,
      current_value_uncrystallised: 12500,
      end_value_crystallised: 0,
      end_value_uncrystallised: 13125,
      start_value_crystallised: 0,
      start_value_uncrystallised: 10000,
    });

    expect(year1).toEqual({
      start_value: 13125,
      current_value: 15625,
      net_growth: 0.05,
      end_value: 16406.25,

      current_value_crystallised: 0,
      current_value_uncrystallised: 15625,
      end_value_crystallised: 0,
      end_value_uncrystallised: 16406.25,
      start_value_crystallised: 0,
      start_value_uncrystallised: 13125,
    });
  });

  test('personal contribution to money purchase is grossed up (self-employed)', () => {
    const person = makePerson({ date_of_birth: '1985-01-01' });

    const salary = makeIncome({
      type: 'self_employment',
      people: [person],
      values: [
        {
          value: 15000,
          starts_at: iso('2025-09-30'),
          ends_at: iso('2030-09-30'),
          escalation: 'rpi',
        },
      ],
    });

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          date: iso('2025-09-30'),
          value: 10000,
          uncrystallised_value: 10000,
          crystallised_value: 0,
        },
      ],
      growth_template: { type: 'flat', rate: { gross_rate: 0.05, charges: 0 } },
      contributions: [
        {
          type: 'personal',
          value: 2000,
          starts_at: iso('2025-09-30'),
          ends_at: iso('2027-09-30'),
          escalation: 0,
        },
      ],
    });

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2025-09-30'),
      years: 2,
      money_purchases: [pension],
      incomes: [salary],
    });

    const output = run(cashflow);
    const [year0, year1] = output.money_purchases[pension.id].years;

    expect(year0).toEqual({
      start_value: 10000,
      current_value: 12500, // 2000 contribution grossed-up to 2500
      end_value: 13125,
      net_growth: 0.05,

      current_value_crystallised: 0,
      current_value_uncrystallised: 12500,
      end_value_crystallised: 0,
      end_value_uncrystallised: 13125,
      start_value_crystallised: 0,
      start_value_uncrystallised: 10000,
    });

    expect(year1).toEqual({
      start_value: 13125,
      current_value: 15625,
      net_growth: 0.05,
      end_value: 16406.25,

      current_value_crystallised: 0,
      current_value_uncrystallised: 15625,
      end_value_crystallised: 0,
      end_value_uncrystallised: 16406.25,
      start_value_crystallised: 0,
      start_value_uncrystallised: 13125,
    });
  });

  test('personal contribution to money purchase is grossed up (taxable "other")', () => {
    const person = makePerson({ date_of_birth: '1985-01-01' });

    const salary = makeIncome({
      type: 'other_taxable',
      people: [person],
      values: [
        {
          value: 15000,
          starts_at: iso('2025-09-30'),
          ends_at: iso('2030-09-30'),
          escalation: 'rpi',
        },
      ],
    });

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          date: iso('2025-09-30'),
          value: 10000,
          uncrystallised_value: 10000,
          crystallised_value: 0,
        },
      ],
      growth_template: { type: 'flat', rate: { gross_rate: 0.05, charges: 0 } },
      contributions: [
        {
          type: 'personal',
          value: 2000,
          starts_at: iso('2025-09-30'),
          ends_at: iso('2027-09-30'),
          escalation: 0,
        },
      ],
    });

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2025-09-30'),
      years: 2,
      money_purchases: [pension],
      incomes: [salary],
    });

    const output = run(cashflow);
    const [year0, year1] = output.money_purchases[pension.id].years;

    expect(year0).toEqual({
      start_value: 10000,
      current_value: 12500, // 2000 contribution grossed-up to 2500
      end_value: 13125,
      net_growth: 0.05,

      current_value_crystallised: 0,
      current_value_uncrystallised: 12500,
      end_value_crystallised: 0,
      end_value_uncrystallised: 13125,
      start_value_crystallised: 0,
      start_value_uncrystallised: 10000,
    });

    expect(year1).toEqual({
      start_value: 13125,
      current_value: 15625,
      net_growth: 0.05,
      end_value: 16406.25,

      current_value_crystallised: 0,
      current_value_uncrystallised: 15625,
      end_value_crystallised: 0,
      end_value_uncrystallised: 16406.25,
      start_value_crystallised: 0,
      start_value_uncrystallised: 13125,
    });
  });

  test('correct basic rate relief applied (scotland)', () => {
    const person = makePerson({
      date_of_birth: '1980-01-01',
      sex: 'male',
      tax_residency: 'sco',
    });

    const salary = makeIncome({
      people: [person],
      values: [
        {
          value: 55000,
          starts_at: iso('2025-09-30'),
          ends_at: iso('2032-09-30'),
          escalation: 'cpi',
        },
      ],
    });

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          date: iso('2025-09-30'),
          value: 10000,
          uncrystallised_value: 10000,
          crystallised_value: 0,
        },
      ],
      growth_template: { type: 'flat', rate: { gross_rate: 0.05, charges: 0 } },
      contributions: [
        {
          type: 'personal',
          value: 2000,
          starts_at: iso('2025-09-30'),
          ends_at: iso('2027-09-30'),
          escalation: 0,
        },
      ],
    });

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2025-09-30'),
      years: 2,
      money_purchases: [pension],
      incomes: [salary],
    });

    const output = run(cashflow);
    const [year0, year1] = output.money_purchases[pension.id].years;

    expect(year0).toEqual({
      start_value: 10000,
      current_value: 12500, // 2000 contribution grossed-up to 2500
      end_value: 13125,
      net_growth: 0.05,

      current_value_crystallised: 0,
      current_value_uncrystallised: 12500,
      end_value_crystallised: 0,
      end_value_uncrystallised: 13125,
      start_value_crystallised: 0,
      start_value_uncrystallised: 10000,
    });

    expect(year1).toEqual({
      start_value: 13125,
      current_value: 15625,
      net_growth: 0.05,
      end_value: 16406.25,

      current_value_crystallised: 0,
      current_value_uncrystallised: 15625,
      end_value_crystallised: 0,
      end_value_uncrystallised: 16406.25,
      start_value_crystallised: 0,
      start_value_uncrystallised: 13125,
    });
  });

  test('only relevant individuals are applicable for tax relief', () => {
    // Over 75 years old
    const person = makePerson({ date_of_birth: '1948-01-01' });

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          date: iso('2025-09-30'),
          value: 10000,
          uncrystallised_value: 10000,
          crystallised_value: 0,
        },
      ],
      growth_template: { type: 'flat', rate: { gross_rate: 0.05, charges: 0 } },
      contributions: [
        {
          type: 'personal',
          value: 2000,
          starts_at: iso('2025-09-30'),
          ends_at: iso('2027-09-30'),
          escalation: 0,
        },
      ],
    });

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2025-09-30'),
      years: 2,
      money_purchases: [pension],
      incomes: [],
    });

    const output = run(cashflow);
    const [year0, year1] = output.money_purchases[pension.id].years;

    expect(year0).toEqual({
      start_value: 10000,
      current_value: 12000, // 2000 contribution not grossed-up
      end_value: 12600,
      net_growth: 0.05,

      current_value_crystallised: 0,
      current_value_uncrystallised: 12000,
      end_value_crystallised: 0,
      end_value_uncrystallised: 12600,
      start_value_crystallised: 0,
      start_value_uncrystallised: 10000,
    });

    expect(year1).toEqual({
      start_value: 12600,
      current_value: 14600,
      net_growth: 0.05,
      end_value: 15330,

      current_value_crystallised: 0,
      current_value_uncrystallised: 14600,
      end_value_crystallised: 0,
      end_value_uncrystallised: 15330,
      start_value_crystallised: 0,
      start_value_uncrystallised: 12600,
    });
  });

  test('non-personal contributions dont get tax relief', () => {
    const person = makePerson({ date_of_birth: '1985-01-01' });

    const salary = makeIncome({
      people: [person],
      values: [
        {
          value: 15000,
          starts_at: iso('2025-09-30'),
          ends_at: iso('2032-09-30'),
          escalation: 'cpi',
        },
      ],
    });

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          date: iso('2025-09-30'),
          value: 10000,
          uncrystallised_value: 10000,
          crystallised_value: 0,
        },
      ],
      growth_template: { type: 'flat', rate: { gross_rate: 0.05, charges: 0 } },
      contributions: [
        {
          type: 'employer',
          value: 2000,
          starts_at: iso('2025-09-30'),
          ends_at: iso('2027-09-30'),
          escalation: 0,
        },
      ],
    });

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2025-09-30'),
      years: 2,
      money_purchases: [pension],
      incomes: [salary],
    });

    const output = run(cashflow);
    const [year0, year1] = output.money_purchases[pension.id].years;

    expect(year0).toEqual({
      start_value: 10000,
      start_value_crystallised: 0,
      start_value_uncrystallised: 10000,
      current_value: 12000, // 2000 contribution grossed-up to 2500
      current_value_crystallised: 0,
      current_value_uncrystallised: 12000,
      end_value: 12600,
      end_value_crystallised: 0,
      end_value_uncrystallised: 12600,
      net_growth: 0.05,
    });

    expect(year1).toEqual({
      start_value: 12600,
      current_value: 14600,
      net_growth: 0.05,
      end_value: 15330,

      current_value_crystallised: 0,
      current_value_uncrystallised: 14600,
      end_value_crystallised: 0,
      end_value_uncrystallised: 15330,
      start_value_crystallised: 0,
      start_value_uncrystallised: 12600,
    });
  });

  test('basic amount gets converted to real terms', () => {
    const person = makePerson({ date_of_birth: '1985-01-01' });

    const growthRate = 0.05;
    const cpi = 0.025;

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          date: iso('2025-09-30'),
          value: 10000,
          uncrystallised_value: 10000,
          crystallised_value: 0,
        },
      ],
      growth_template: {
        type: 'flat',
        rate: { gross_rate: growthRate, charges: 0 },
      },
      contributions: [
        {
          type: 'personal',
          value: 4000,
          starts_at: iso('2025-09-30'),
          ends_at: iso('2028-09-30'),
          escalation: 0,
        },
      ],
    });

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2025-09-30'),
      years: 2,
      money_purchases: [pension],
      assumptions: { terms: 'real', cpi },
    });

    const output = run(cashflow);
    const years = output.money_purchases[pension.id].years;

    /**
     * 2880 out of 4000 gets grossed up, 1120 doesn't
     * ((2880/.8)=3600)+1120 = 4720
     */

    expect(years[0]).toEqual({
      start_value: 10000,
      start_value_crystallised: 0,
      start_value_uncrystallised: 10000,
      current_value: 10000 + 4720,
      current_value_crystallised: 0,
      current_value_uncrystallised: 10000 + 4720,
      end_value: round((10000 + 4720) * applyGrowth(growthRate, cpi), 2),
      end_value_crystallised: 0,
      end_value_uncrystallised: 15079.02,
      net_growth: growthRate,
    });

    /**
     * start value 15079.02
     * net contribution drops to 3902.44 in real terms
     * basic amount drops to 3512.2 (real terms)
     * 2809.76 out of 3902.44 gets grossed up, 1092.68 doesn't
     * ((2809.76/.8)=3512.2)+1092.68 = 4604.88
     */

    expect(years[1]).toEqual({
      start_value: 15079.02,
      start_value_crystallised: 0,
      start_value_uncrystallised: 15079.02,
      current_value: 15079.02 + 4604.88,
      current_value_crystallised: 0,
      current_value_uncrystallised: 19683.9,
      end_value: round((15079.02 + 4604.88) * applyGrowth(growthRate, cpi), 2),
      end_value_crystallised: 0,
      end_value_uncrystallised: 20164,
      net_growth: growthRate,
    });
  });
});
