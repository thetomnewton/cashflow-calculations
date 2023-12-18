import { round } from 'lodash'
import { run } from '../src/calculations'
import {
  makeAccount,
  makeCashflow,
  makeExpense,
  makeIncome,
  makeMoneyPurchase,
  makePerson,
} from '../src/factories'
import { iso } from '../src/lib/date'
import { Account } from '../src/types'

describe('expenses', () => {
  test('income surplus added to sweep', () => {
    const person = makePerson({ date_of_birth: '1965-06-09' })

    const salary = makeIncome({
      type: 'employment',
      people: [person],
      values: [
        {
          value: 30000,
          starts_at: iso('2023-12-20'),
          ends_at: iso('2025-12-20'),
          escalation: 'cpi',
        },
      ],
    })

    const costs = makeExpense({
      values: [
        {
          value: 15000,
          starts_at: iso('2023-12-20'),
          ends_at: iso('2025-12-20'),
          escalation: 'cpi',
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      incomes: [salary],
      expenses: [costs],
      assumptions: { windfall_save: 'sweep' },
    })

    const out = run(cashflow)

    expect(out.incomes[salary.id].years[0].net_value).toBe(24422.4)
    expect(out.expenses[costs.id].years[0].value).toEqual(15000)

    const sweep = cashflow.accounts.find(acc => acc.is_sweep)
    expect(out.accounts[(sweep as Account).id].years[0].current_value).toBe(
      round(24422.4 - 15000, 2)
    )
  })

  test('income surplus discarded', () => {
    const person = makePerson({ date_of_birth: '1965-06-09' })

    const salary = makeIncome({
      type: 'employment',
      people: [person],
      values: [
        {
          value: 30000,
          starts_at: iso('2023-12-20'),
          ends_at: iso('2025-12-20'),
          escalation: 'cpi',
        },
      ],
    })

    const costs = makeExpense({
      values: [
        {
          value: 15000,
          starts_at: iso('2023-12-20'),
          ends_at: iso('2025-12-20'),
          escalation: 'cpi',
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      incomes: [salary],
      expenses: [costs],
      assumptions: { windfall_save: 'discard' },
    })

    const out = run(cashflow)

    expect(out.incomes[salary.id].years[0].net_value).toBe(24422.4)
    expect(out.expenses[costs.id].years[0].value).toEqual(15000)

    const sweep = cashflow.accounts.find(acc => acc.is_sweep)
    expect(out.accounts[(sweep as Account).id].years[0].current_value).toBe(0)
  })

  test('simple shortfall handled', () => {
    /**
     * 55k salary/year, 75k expenses/year, 100k in isa, 2 year cashflow
     * isa covers shortfall, sweep account remains at 0
     */
    const person = makePerson({ date_of_birth: '1980-04-04' })

    const salary = makeIncome({
      type: 'employment',
      people: [person],
      values: [
        {
          value: 55000,
          starts_at: iso('2023-12-20'),
          ends_at: iso('2025-12-20'),
          escalation: 'rpi',
        },
      ],
    })

    const costs = makeExpense({
      values: [
        {
          value: 75000,
          starts_at: iso('2023-12-20'),
          ends_at: iso('2025-12-20'),
          escalation: 'cpi',
        },
      ],
    })

    const isa = makeAccount({
      category: 'isa',
      owner_id: person.id,
      valuations: [{ value: 100000, date: iso('2023-12-20') }],
      growth_template: { type: 'flat', rate: { gross_rate: 0.03, charges: 0 } },
    })

    const cashflow = makeCashflow({
      people: [person],
      incomes: [salary],
      expenses: [costs],
      accounts: [isa],
    })
    const out = run(cashflow)

    const sweep = cashflow.accounts.find(acc => acc.is_sweep)

    expect(out.accounts[(sweep as Account).id].years[0]).toEqual({
      start_value: 0,
      current_value: 0,
      end_value: 0,
      net_growth: 0.005,
    })

    expect(out.incomes[salary.id].years[0].net_value).toEqual(40949.4)

    expect(out.accounts[isa.id].years[0]).toEqual({
      start_value: 100000,
      net_growth: 0.03,
      current_value: round(100000 - (75000 - 40949.4), 2),
      end_value: 67927.88,
    })
  })

  test('simple shortfall handled (pension)', () => {
    /**
     * 5k salary/year, 7k expenses/year, 50k in DC pension, 3 year cashflow
     * pension covers shortfall, sweep account remains at 0
     */
    const person = makePerson({ date_of_birth: '1980-04-04' })

    const salary = makeIncome({
      type: 'employment',
      people: [person],
      values: [
        {
          value: 5000,
          starts_at: iso('2023-12-20'),
          ends_at: iso('2025-12-20'),
          escalation: 'rpi',
        },
      ],
    })

    const costs = makeExpense({
      values: [
        {
          value: 7000,
          starts_at: iso('2023-12-20'),
          ends_at: iso('2025-12-20'),
          escalation: 'cpi',
        },
      ],
    })

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          value: 50000,
          uncrystallised_value: 50000,
          crystallised_value: 0,
          date: iso('2023-12-20'),
        },
      ],
      growth_template: { type: 'flat', rate: { gross_rate: 0.03, charges: 0 } },
    })

    const cashflow = makeCashflow({
      people: [person],
      incomes: [salary],
      expenses: [costs],
      money_purchases: [pension],
    })
    const out = run(cashflow)

    const sweep = cashflow.accounts.find(acc => acc.is_sweep)

    expect(out.accounts[(sweep as Account).id].years[0]).toEqual({
      start_value: 0,
      current_value: 0,
      end_value: 0,
      net_growth: 0.005,
    })

    expect(out.incomes[salary.id].years[0].net_value).toEqual(5000)

    expect(out.money_purchases[pension.id].years[0]).toEqual({
      start_value: 50000,
      start_value_uncrystallised: 50000,
      start_value_crystallised: 0,
      current_value: 48000,
      current_value_uncrystallised: 48000,
      current_value_crystallised: 0,
      end_value: 48000 * 1.03,
      end_value_uncrystallised: 48000 * 1.03,
      end_value_crystallised: 0,
      net_growth: 0.03,
    })
  })
})
