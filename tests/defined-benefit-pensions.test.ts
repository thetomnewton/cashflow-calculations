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
      owner_id: person.id,
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
      years: 8,
    })

    const out = run(cashflow)

    const inc = cashflow.incomes.find(inc => inc.source_id === db.id)
    if (!inc) throw new Error('missing income')

    // Expect income to be created in year 6
    const netValues = out.incomes[inc.id].years.map(year => year.net_value)
    expect(netValues).toEqual([0, 0, 0, 0, 0, 0, 10000, 10000])
  })
})
