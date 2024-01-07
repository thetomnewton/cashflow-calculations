import { v4 } from 'uuid'
import { run } from '../src/calculations'
import { makeCashflow, makePerson } from '../src/factories'
import { date, iso } from '../src/lib/date'
import { EmploymentIncome } from '../src/types'

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
    ]

    const out = cashflows.map(cashflow => run(cashflow))

    expect(out[0].years[0].tax_year).toBe('2324')
    expect(out[0].years[3].tax_year).toBe('2627')
    expect(out[0].years[3].starts_at).toBe(iso('2026-07-03'))
    expect(out[0].years[3].ends_at).toBe(iso('2027-07-03'))
  })

  test('income is initialised correctly (cpi, nominal)', () => {
    const person = makePerson({ sex: 'female' })
    const startsAt = date().startOf('day')
    const incomeId = v4()
    const cashflow = makeCashflow({
      people: [person],
      starts_at: startsAt.toISOString(),
      years: 5,
      assumptions: {
        cpi: 0.025,
        terms: 'nominal',
      },
      incomes: [
        {
          id: incomeId,
          type: 'employment',
          people: [person],
          values: [
            {
              value: 10000,
              starts_at: startsAt.toISOString(),
              ends_at: startsAt.add(5, 'year').toISOString(),
              escalation: 'cpi',
            },
          ],
        },
      ],
    })

    const out = run(cashflow)
    const values = out.incomes[incomeId].years.map(year => year.gross_value)

    expect(values[0]).toBe(10000)
    expect(values[1]).toBe(10250)
    expect(values[2]).toBe(10506.25)
    expect(values[3]).toBe(10768.91)
    expect(values[4]).toBe(11038.13)
  })

  test('income is initialised correctly (rpi, real)', () => {
    const person = makePerson({ sex: 'male' })
    const startsAt = date().startOf('day')
    const incomeId = v4()
    const cashflow = makeCashflow({
      people: [person],
      starts_at: startsAt.toISOString(),
      years: 5,
      assumptions: {
        cpi: 0.03,
        rpi: 0.035,
        terms: 'real',
      },
      incomes: [
        {
          id: incomeId,
          type: 'employment',
          people: [person],
          values: [
            {
              value: 15000,
              starts_at: startsAt.toISOString(),
              ends_at: startsAt.add(5, 'year').toISOString(),
              escalation: 'rpi',
            },
          ],
        },
      ],
    })

    const out = run(cashflow)
    const values = out.incomes[incomeId].years.map(year => year.gross_value)

    expect(values[0]).toBe(15000)
    expect(values[1]).toBe(15072.82)
    expect(values[2]).toBe(15145.98)
    expect(values[3]).toBe(15219.51)
    expect(values[4]).toBe(15293.39)
  })

  test('income with bonus and benefits initialises correctly', () => {
    const person = makePerson({ sex: 'male' })
    const startsAt = date().startOf('day')
    const salary: EmploymentIncome = {
      id: v4(),
      type: 'employment',
      people: [person],
      values: [
        {
          value: 15000,
          bonus: 3000,
          benefits: 2000,
          starts_at: startsAt.toISOString(),
          ends_at: startsAt.add(5, 'year').toISOString(),
          escalation: 0,
        },
      ],
    }

    const cashflow = makeCashflow({
      people: [person],
      starts_at: startsAt.toISOString(),
      years: 3,
      assumptions: { terms: 'nominal' },
      incomes: [salary],
    })

    const out = run(cashflow)
    const grossValues = out.incomes[salary.id].years.map(
      year => year.gross_value
    )
    const taxableValues = out.incomes[salary.id].years.map(
      year => year.taxable_value
    )

    expect(grossValues).toEqual([15000, 15000, 15000])
    expect(taxableValues).toEqual([20000, 20000, 20000])
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
