import { v4 } from 'uuid'
import { run } from '../src/calculations'
import { makeCashflow, makePerson } from '../src/factories'
import { iso } from '../src/lib/date'
import { DeferredDBPension } from '../src/types'

describe('defined benefit pensions', () => {
  test('deferred DB produces income at correct time', () => {
    const person = makePerson({ date_of_birth: '1964-06-01' })

    const db: DeferredDBPension = {
      id: v4(),
      status: 'deferred',
      annual_amount: 10000,
      deferment_escalation_rate: 0,
      active_escalation_rate: 0,
      normal_retirement_age: 65,
      starts_at: iso('2029-06-01'),
    }

    const cashflow = makeCashflow({
      people: [person],
      defined_benefits: [db],
      starts_at: iso('2023-06-01'),
      years: 7,
    })

    const out = run(cashflow)

    // Expect income to be created in year 5
    expect(out.incomes[0].years[0].net_value).toEqual(0)
    expect(out.incomes[0].years[1].net_value).toEqual(0)
    expect(out.incomes[0].years[2].net_value).toEqual(0)
    expect(out.incomes[0].years[3].net_value).toEqual(0)
    expect(out.incomes[0].years[4].net_value).toEqual(0)
    expect(out.incomes[0].years[5].net_value).toEqual(10000)
    expect(out.incomes[0].years[6].net_value).toEqual(10000)
  })
})
