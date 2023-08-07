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

  test('can run a cashflow', () => {
    const today = date().startOf('day').toISOString()
    const cashflow = makeCashflow({
      people: [makePerson({ sex: 'female' })],
      starts_at: today,
      years: 5,
    })

    const out = run(cashflow)

    expect(out.starts_at).toBe(today)
    expect(out.years.length).toBe(5)
  })
})
