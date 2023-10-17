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
    const person = makePerson({ date_of_birth: '1985-01-01', sex: 'female' })

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
    const person = makePerson({ date_of_birth: '1985-01-01', sex: 'female' })

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

  test('higher rate english taxpayer gets higher rate tax relief', () => {
    /**
     * - Salary £80,000
     * - Pays £35,000 net personally into a PPP
     * - Basic rate relief is applied to the whole contribution, taking it to £43,750
     * - Additional 20% relief is available on the approx 30k above higher rate threshold
     * - 29730/.6=49550, 5270/.8=6587.5 so £56,137.50 goes into the pot
     * - Basic band gets extended by £56,137.50
     */

    const person = makePerson({ date_of_birth: '1980-05-05', sex: 'male' })
    const salary = makeIncome({
      type: 'employment',
      people: [person],
      values: [
        {
          value: 80000,
          starts_at: iso('2023-09-01'),
          ends_at: iso('2040-09-01'),
          escalation: 0,
        },
      ],
    })

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          value: 0,
          uncrystallised_value: 0,
          crystallised_value: 0,
          date: iso('2023-09-01'),
        },
      ],
      growth_template: { type: 'flat', rate: { gross_rate: 0.05, charges: 0 } },
      contributions: [
        {
          type: 'personal',
          value: 35000,
          starts_at: iso('2023-09-01'),
          ends_at: iso('2040-09-01'),
          escalation: 0,
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-09-01'),
      years: 1,
      incomes: [salary],
      accounts: [pension],
    })
    const output = run(cashflow)

    expect(output.accounts[pension.id].years[0]).toEqual({
      start_value: 0,
      net_growth: 0.05,
      current_value: 56137.5,
      end_value: 58944.38,
    })

    const basicBand = output.tax.bands[2324][person.id].find(
      band => band.key === 'basic_rate_eng'
    )

    expect(basicBand).toEqual({
      key: 'basic_rate_eng',
      bound_lower: 0,
      bound_upper_original: 37700,
      bound_upper: 96644.38,
      remaining: 0,
      id: basicBand?.id,
    })
  })

  test('basic band gets grossed up (scotland)', () => {
    const person = makePerson({ date_of_birth: '1980-01-01', sex: 'male' })

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

    // todo: complete
  })

  test('only relevant individuals are applicable for tax relief', () => {
    const person = makePerson({ date_of_birth: '1985-01-01', sex: 'female' })

    // todo: complete
  })

  test('employer contributions dont get grossed up', () => {
    const person = makePerson({ date_of_birth: '1980-01-01', sex: 'male' })

    // todo: complete
  })
})
