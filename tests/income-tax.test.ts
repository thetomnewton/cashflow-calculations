import { v4 } from 'uuid'
import { iso } from '../src/lib/date'
import { run } from '../src/calculations'
import { makeCashflow, makeIncome, makePerson } from '../src/factories'
import { sumBy } from 'lodash'

describe('income tax', () => {
  const person = makePerson({ sex: 'male', tax_residency: 'eng' })
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
            escalation: 0,
          },
        ],
      }),
    ],
  })

  test('basic rate salary is taxed correctly', () => {
    const out = run(basicRateCashflow)

    expect(
      sumBy(Object.values(out.incomes[salaryId].years[0].tax.bands), 'tax_paid')
    ).toBe(5486)
  })

  test('personal allowance tapers correctly', () => {
    const salaryId = v4()
    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 3,
      incomes: [
        makeIncome({
          id: salaryId,
          people: [person],
          values: [
            {
              value: 110000,
              starts_at: iso('2023-04-06'),
              ends_at: iso('2028-04-06'),
              escalation: 'cpi',
            },
          ],
        }),
      ],
    })

    const out = run(cashflow)

    expect(
      out.tax.bands[2324][person.id].find(b => b.key === 'personal_allowance')
        .bound_upper
    ).toBe(7570)
  })

  // test('salary within PA does not get taxed', () => {
  //   //
  // })

  // test('higher rate salary gets taxed correctly', () => {
  //   //
  // })

  // test('pa tapering works correctly', () => {
  //   //
  // })

  // test('additional rate salary gets taxed correctly', () => {
  //   //
  // })

  // test('', () => {
  //   //
  // })
})
