import { v4 } from 'uuid'
import { iso } from '../src/lib/date'
import { run } from '../src/calculations'
import { makeCashflow, makeIncome, makePerson } from '../src/factories'

describe('income tax', () => {
  const person = makePerson({ sex: 'male' })

  const salaryId = v4()

  const basicRateCashflow = makeCashflow({
    people: [person],
    starts_at: iso('2023-04-06'),
    years: 5,
    incomes: [
      makeIncome({
        id: salaryId,
        people: [person],
        values: [
          {
            value: 40000,
            starts_at: iso('2023-04-06'),
            ends_at: iso('2028-04-06'),
          },
        ],
      }),
    ],
  })

  test('basic rate salary gets taxed correctly', () => {
    const out = run(basicRateCashflow)

    expect(out.incomes[salaryId].year[0].tax.tax_paid).toBe(5486)
  })

  test('salary within PA does not get taxed', () => {
    //
  })

  test('higher rate salary gets taxed correctly', () => {
    //
  })

  test('pa tapering works correctly', () => {
    //
  })

  test('additional rate salary gets taxed correctly', () => {
    //
  })

  test('', () => {
    //
  })
})
