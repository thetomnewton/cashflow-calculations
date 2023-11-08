import { run } from '../src/calculations'
import { isAccount } from '../src/calculations/accounts'
import {
  makeAccount,
  makeCashflow,
  makeIncome,
  makeMoneyPurchase,
  makePerson,
} from '../src/factories'
import { iso } from '../src/lib/date'

describe('contributions', () => {
  test('can make a personal contribution to a cash account', () => {
    const person = makePerson({ date_of_birth: '1985-01-01' })

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
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 1,
      accounts: [cash1],
    })
    const output = run(cashflow)

    expect(output.accounts[cash1.id].years[0].end_value).toEqual(2100)

    const sweep = cashflow.accounts.find(acc => isAccount(acc) && acc.is_sweep)
    expect(output.accounts[sweep?.id as string].years[0].end_value).toEqual(
      -1000
    )
  })

  test('personal contribution to money purchase is grossed up', () => {
    const person = makePerson({ date_of_birth: '1985-01-01' })

    const salary = makeIncome({
      people: [person],
      values: [
        {
          value: 15000,
          starts_at: iso('2023-09-30'),
          ends_at: iso('2030-09-30'),
          escalation: 'cpi',
        },
      ],
    })

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          date: iso('2023-09-30'),
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
          starts_at: iso('2023-09-30'),
          ends_at: iso('2025-09-30'),
          escalation: 0,
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-09-30'),
      years: 2,
      accounts: [pension],
      incomes: [salary],
    })

    const output = run(cashflow)
    const [year0, year1] = output.accounts[pension.id].years

    expect(year0).toEqual({
      start_value: 10000,
      current_value: 12500, // 2000 contribution grossed-up to 2500
      end_value: 13125,
      net_growth: 0.05,
    })

    expect(year1).toEqual({
      start_value: 13125,
      current_value: 15625,
      net_growth: 0.05,
      end_value: 16406.25,
    })
  })

  test('correct basic rate relief applied (scotland)', () => {
    const person = makePerson({
      date_of_birth: '1980-01-01',
      sex: 'male',
      tax_residency: 'sco',
    })

    const salary = makeIncome({
      people: [person],
      values: [
        {
          value: 55000,
          starts_at: iso('2023-09-30'),
          ends_at: iso('2030-09-30'),
          escalation: 'cpi',
        },
      ],
    })

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          date: iso('2023-09-30'),
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
          starts_at: iso('2023-09-30'),
          ends_at: iso('2025-09-30'),
          escalation: 0,
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-09-30'),
      years: 2,
      accounts: [pension],
      incomes: [salary],
    })

    const output = run(cashflow)
    const [year0, year1] = output.accounts[pension.id].years

    expect(year0).toEqual({
      start_value: 10000,
      current_value: 12500, // 2000 contribution grossed-up to 2500
      end_value: 13125,
      net_growth: 0.05,
    })

    expect(year1).toEqual({
      start_value: 13125,
      current_value: 15625,
      net_growth: 0.05,
      end_value: 16406.25,
    })
  })

  test('only relevant individuals are applicable for tax relief', () => {
    // Over 75 years old
    const person = makePerson({ date_of_birth: '1948-01-01' })

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          date: iso('2023-09-30'),
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
          starts_at: iso('2023-09-30'),
          ends_at: iso('2025-09-30'),
          escalation: 0,
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-09-30'),
      years: 2,
      accounts: [pension],
      incomes: [],
    })

    const output = run(cashflow)
    const [year0, year1] = output.accounts[pension.id].years

    expect(year0).toEqual({
      start_value: 10000,
      current_value: 12000, // 2000 contribution not grossed-up
      end_value: 12600,
      net_growth: 0.05,
    })

    expect(year1).toEqual({
      start_value: 12600,
      current_value: 14600,
      net_growth: 0.05,
      end_value: 15330,
    })
  })

  test('non-personal contributions dont get tax relief', () => {
    const person = makePerson({ date_of_birth: '1985-01-01' })

    const salary = makeIncome({
      people: [person],
      values: [
        {
          value: 15000,
          starts_at: iso('2023-09-30'),
          ends_at: iso('2030-09-30'),
          escalation: 'cpi',
        },
      ],
    })

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          date: iso('2023-09-30'),
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
          starts_at: iso('2023-09-30'),
          ends_at: iso('2025-09-30'),
          escalation: 0,
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-09-30'),
      years: 2,
      accounts: [pension],
      incomes: [salary],
    })

    const output = run(cashflow)
    const [year0, year1] = output.accounts[pension.id].years

    expect(year0).toEqual({
      start_value: 10000,
      current_value: 12000, // 2000 contribution grossed-up to 2500
      end_value: 12600,
      net_growth: 0.05,
    })

    expect(year1).toEqual({
      start_value: 12600,
      current_value: 14600,
      net_growth: 0.05,
      end_value: 15330,
    })
  })
})
