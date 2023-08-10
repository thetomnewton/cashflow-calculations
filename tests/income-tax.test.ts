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
        type: 'employment',
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
    const outputIncomeYear = out.incomes[salaryId].years[0]

    expect(
      sumBy(Object.values(outputIncomeYear.tax.bands), 'tax_paid')
    ).toEqual(5486)

    expect(outputIncomeYear.net_value).toEqual(30000)
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
          type: 'employment',
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

  test('salary within PA does not get taxed', () => {
    const incomeId = v4()
    const person = makePerson({ sex: 'female', tax_residency: 'wal' })
    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-08-10'),
      years: 2,
      incomes: [
        makeIncome({
          id: incomeId,
          type: 'employment',
          people: [person],
          values: [
            {
              value: 10000,
              starts_at: iso('2023-08-10'),
              ends_at: iso('2025-08-10'),
              escalation: 0,
            },
          ],
        }),
      ],
    })

    const out = run(cashflow)
    const outputIncomeYear = out.incomes[incomeId].years[0]

    expect(
      sumBy(Object.values(outputIncomeYear.tax.bands), 'tax_paid')
    ).toEqual(0)
    expect(outputIncomeYear.net_value).toEqual(10000)
  })

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
