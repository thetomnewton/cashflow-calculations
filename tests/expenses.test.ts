import { round } from 'lodash'
import { run } from '../src/calculations'
import {
  makeCashflow,
  makeExpense,
  makeIncome,
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
})
