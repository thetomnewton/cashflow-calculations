import { date } from '../src/lib/date'
import { run } from '../src/calculations'
import { makeCashflow, makePerson } from '../src/factories'

describe('initialisation tests', () => {
  test('can set cashflow params', () => {
    const startDate = date('2023-04-06').toISOString()
    const cashflow = makeCashflow({
      people: [makePerson({ sex: 'male' })],
      starts_at: startDate,
    })

    expect(cashflow.starts_at).toBe(startDate)
  })

  test('can create a cashflow', () => {
    const cashflow = makeCashflow({
      people: [makePerson({ sex: 'male' })],
    })

    const out = run(cashflow)

    expect(out.starts_at).toBe(date().startOf('day').toISOString())
    expect(out.ends_at).toBe(date().startOf('day').add(1, 'year').toISOString())
  })
})
