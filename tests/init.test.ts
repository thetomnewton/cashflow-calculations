import { run } from '../src/calculations'
import { date, iso } from '../src/lib/date'
import { makeCashflow, makePerson } from '../src/factories'

describe('initialisation tests', () => {
  test('can set cashflow params', () => {
    const startDate = iso('2023-04-06')
    const cashflow = makeCashflow({
      people: [makePerson({ sex: 'male' })],
      starts_at: startDate,
    })

    expect(cashflow.starts_at).toBe(startDate)
  })

  test('tax bands generate correctly', () => {
    const cashflows = [
      makeCashflow({
        people: [makePerson({ sex: 'male' })],
        starts_at: iso('2023-07-03'),
        years: 4,
      }),
      makeCashflow({
        people: [makePerson({ sex: 'female' })],
        starts_at: iso('2023-03-06'),
        years: 4,
      }),
    ]

    const out = cashflows.map(cashflow => run(cashflow))

    expect(out[0].years[0].tax_year).toBe('2324')
    expect(out[0].years[3].tax_year).toBe('2627')
    expect(out[0].years[3].starts_at).toBe(iso('2026-07-03'))
    expect(out[0].years[3].ends_at).toBe(iso('2027-07-03'))

    expect(out[1].years[2].tax_year).toBe('2425')
    expect(out[1].years[2].starts_at).toBe(iso('2025-03-06'))
    expect(out[1].years[2].ends_at).toBe(iso('2026-03-06'))
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
