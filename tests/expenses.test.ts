import { run } from '../src/calculations'
import {
  makeCashflow,
  makeExpense,
  makeIncome,
  makePerson,
} from '../src/factories'
import { iso } from '../src/lib/date'

describe('expenses', () => {
  test('expense comes from income surplus', () => {
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
    })

    const out = run(cashflow)

    expect(out.expenses[costs.id].years[0]).toEqual({
      value: 15000,
    })
  })
})
