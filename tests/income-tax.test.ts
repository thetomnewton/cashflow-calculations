import { sumBy } from 'lodash'
import { v4 } from 'uuid'
import { run } from '../src/calculations'
import { makeCashflow, makeIncome, makePerson } from '../src/factories'
import { iso } from '../src/lib/date'

describe('income tax', () => {
  test('basic rate salary is taxed correctly', () => {
    const person = makePerson({ sex: 'male', tax_residency: 'eng' })
    const salary = makeIncome({
      id: v4(),
      people: [person],
      type: 'employment',
      values: [
        {
          value: 40000,
          starts_at: iso('2023-04-06'),
          ends_at: iso('2024-01-01'), // Should still apply for the whole year
          escalation: 0,
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 2,
      incomes: [salary],
    })
    const out = run(cashflow)
    const outputIncomeYear = out.incomes[salary.id].years[0]

    expect(outputIncomeYear.tax.bands.personal_allowance.used).toEqual(12570)
    expect(outputIncomeYear.tax.bands.personal_allowance.tax_paid).toEqual(0)
    expect(outputIncomeYear.tax.bands.basic_rate_eng.used).toEqual(27430)
    expect(outputIncomeYear.tax.bands.basic_rate_eng.tax_paid).toEqual(5486)

    expect(outputIncomeYear.tax.ni_paid.class1).toEqual(3291.6)

    expect(outputIncomeYear.net_value).toEqual(31222.4)
  })

  test('personal allowance tapers correctly', () => {
    const person = makePerson({ sex: 'female', tax_residency: 'eng' })
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
        ?.bound_upper
    ).toBe(7570)
  })

  test('salary within PA does not get taxed', () => {
    const person = makePerson({ sex: 'female', tax_residency: 'wal' })
    const salary = makeIncome({
      id: v4(),
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
    })
    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-08-10'),
      years: 2,
      incomes: [salary],
    })

    const out = run(cashflow)
    const outputIncomeYear = out.incomes[salary.id].years[0]

    expect(
      sumBy(Object.values(outputIncomeYear.tax.bands), 'tax_paid')
    ).toEqual(0)

    expect(outputIncomeYear.net_value).toEqual(10000)
  })

  test('higher rate salary gets taxed correctly', () => {
    const person = makePerson({ sex: 'male', tax_residency: 'eng' })
    const salary = makeIncome({
      id: v4(),
      people: [person],
      type: 'employment',
      values: [
        {
          value: 70000,
          starts_at: iso('2023-04-06'),
          ends_at: iso('2025-04-06'),
          escalation: 'rpi',
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 2,
      incomes: [salary],
    })
    const out = run(cashflow)
    const outputIncomeYear = out.incomes[salary.id].years[0]
    const bands = outputIncomeYear.tax.bands

    expect(bands).toEqual({
      personal_allowance: { used: 12570, tax_paid: 0 },
      basic_rate_eng: { used: 37700, tax_paid: 7540 },
      higher_rate_eng: { used: 19730, tax_paid: 7892 },
    })
  })

  test('additional rate salary gets taxed correctly', () => {
    const person = makePerson({ sex: 'female', tax_residency: 'ni' })
    const salary = makeIncome({
      id: v4(),
      people: [person],
      type: 'employment',
      values: [
        {
          value: 170000,
          starts_at: iso('2023-04-06'),
          ends_at: iso('2025-04-06'),
          escalation: 'cpi',
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 2,
      incomes: [salary],
    })
    const out = run(cashflow)
    const outputIncomeYear = out.incomes[salary.id].years[0]
    const bands = outputIncomeYear.tax.bands

    expect(bands).toEqual({
      basic_rate_eng: { used: 37700, tax_paid: 7540 },
      higher_rate_eng: { used: 112300, tax_paid: 44920 },
      additional_rate_eng: { used: 20000, tax_paid: 9000 },
    })

    // Ensure PA tapered down to 0
    const pa = out.tax.bands[2324][person.id].find(
      ({ key }) => key === 'personal_allowance'
    )
    expect(pa?.remaining).toEqual(0)
    expect(pa?.bound_upper).toEqual(0)
  })

  test('self employment income taxed correctly', () => {
    const person = makePerson({ sex: 'female', tax_residency: 'ni' })
    const salary = makeIncome({
      id: v4(),
      people: [person],
      type: 'self_employment',
      values: [
        {
          value: 65000,
          starts_at: iso('2023-04-06'),
          ends_at: iso('2027-04-06'),
          escalation: 0.02,
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 2,
      incomes: [salary],
    })

    const out = run(cashflow)
    const outputIncomeYear = out.incomes[salary.id].years[0]
    const bands = outputIncomeYear.tax.bands

    expect(bands).toEqual({
      personal_allowance: { used: 12570, tax_paid: 0 },
      basic_rate_eng: { used: 37700, tax_paid: 7540 },
      higher_rate_eng: { used: 14730, tax_paid: 5892 },
    })
  })

  test('dividend income taxed correctly', () => {
    const person = makePerson({ sex: 'male', tax_residency: 'wal' })

    const salary = makeIncome({
      id: v4(),
      people: [person],
      type: 'dividend',
      values: [
        {
          value: 65000,
          starts_at: iso('2023-04-06'),
          ends_at: iso('2027-04-06'),
          escalation: 0.02,
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 2,
      incomes: [salary],
    })

    const out = run(cashflow)

    const outputIncomeYear = out.incomes[salary.id].years[0]
    const bands = outputIncomeYear.tax.bands

    expect(bands).toEqual({
      personal_allowance: { used: 12570, tax_paid: 0 },
      dividend_allowance: { used: 1000, tax_paid: 0 },
      basic_rate_eng: { used: 37700, tax_paid: 3298.75 },
      higher_rate_eng: { used: 13730, tax_paid: 4633.88 },
    })
  })

  test('earned income uses scottish rates correctly', () => {
    const person = makePerson({ sex: 'female', tax_residency: 'sco' })

    const salary = makeIncome({
      id: v4(),
      people: [person],
      type: 'employment',
      values: [
        {
          value: 200000,
          starts_at: iso('2023-04-06'),
          ends_at: iso('2025-04-06'),
          escalation: 'rpi',
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 2,
      incomes: [salary],
    })

    const out = run(cashflow)

    const outputIncomeYear = out.incomes[salary.id].years[0]
    const bands = outputIncomeYear.tax.bands

    expect(bands).toEqual({
      starter_rate_sco: { tax_paid: 2799.08, used: 14732 },
      basic_rate_sco: { tax_paid: 2191.2, used: 10956 },
      intermediate_rate_sco: { tax_paid: 3774.54, used: 17974 },
      higher_rate_sco: { tax_paid: 34220.76, used: 81478 },
      top_rate_sco: { tax_paid: 35184.2, used: 74860 },
    })
  })

  test('scottish self employed income uses correct bands', () => {
    const person = makePerson({ sex: 'female', tax_residency: 'sco' })

    const salary = makeIncome({
      id: v4(),
      people: [person],
      type: 'self_employment',
      values: [
        {
          value: 110000,
          starts_at: iso('2023-04-06'),
          ends_at: iso('2025-04-06'),
          escalation: 'cpi',
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 2,
      incomes: [salary],
    })

    const out = run(cashflow)

    const outputIncomeYear = out.incomes[salary.id].years[0]
    const bands = outputIncomeYear.tax.bands

    expect(bands).toEqual({
      personal_allowance: { tax_paid: 0, used: 7570 },
      starter_rate_sco: { tax_paid: 2799.08, used: 14732 },
      basic_rate_sco: { tax_paid: 2191.2, used: 10956 },
      intermediate_rate_sco: { tax_paid: 3774.54, used: 17974 },
      higher_rate_sco: { tax_paid: 24682.56, used: 58768 },
    })
  })

  test('scottish dividend income uses correct bands', () => {
    const person = makePerson({ sex: 'female', tax_residency: 'sco' })

    const salary = makeIncome({
      id: v4(),
      people: [person],
      type: 'dividend',
      values: [
        {
          value: 95000,
          starts_at: iso('2023-04-06'),
          ends_at: iso('2025-04-06'),
          escalation: 0,
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 2,
      incomes: [salary],
    })

    const out = run(cashflow)

    const outputIncomeYear = out.incomes[salary.id].years[0]
    const bands = outputIncomeYear.tax.bands

    expect(bands).toEqual({
      personal_allowance: { tax_paid: 0, used: 12570 },
      basic_rate_eng: { tax_paid: 3298.75, used: 37700 },
      dividend_allowance: { tax_paid: 0, used: 1000 },
      higher_rate_eng: { tax_paid: 14758.88, used: 43730 },
    })
  })

  test('taxable "other" income taxed correctly', () => {
    const person = makePerson({ sex: 'female', tax_residency: 'eng' })
    const salary = makeIncome({
      id: v4(),
      people: [person],
      type: 'other',
      tax_category: 'earned',
      values: [
        {
          value: 85000,
          starts_at: iso('2023-04-06'),
          ends_at: iso('2025-04-06'),
          escalation: 'cpi',
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 2,
      incomes: [salary],
    })
    const out = run(cashflow)
    const outputIncomeYear = out.incomes[salary.id].years[0]
    const bands = outputIncomeYear.tax.bands

    expect(bands).toEqual({
      personal_allowance: { used: 12570, tax_paid: 0 },
      basic_rate_eng: { used: 37700, tax_paid: 7540 },
      higher_rate_eng: { used: 34730, tax_paid: 13892 },
    })
  })

  test('non-taxable "other" income is not taxed', () => {
    const person = makePerson({ sex: 'female', tax_residency: 'eng' })
    const salary = makeIncome({
      id: v4(),
      people: [person],
      type: 'other',
      tax_category: 'non_taxable',
      values: [
        {
          value: 85000,
          starts_at: iso('2023-04-06'),
          ends_at: iso('2025-04-06'),
          escalation: 'cpi',
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 2,
      incomes: [salary],
    })
    const out = run(cashflow)
    const outputIncomeYear = out.incomes[salary.id].years[0]
    const bands = outputIncomeYear.tax.bands

    expect(Object.keys(bands).length).toEqual(0)
    expect(outputIncomeYear.taxable_value).toBe(0)
    expect(outputIncomeYear.net_value).toBe(85000)
  })

  test('pension income taxed correctly', () => {
    const person = makePerson({ sex: 'male', tax_residency: 'wal' })
    const salary = makeIncome({
      id: v4(),
      people: [person],
      type: 'pension',
      values: [
        {
          value: 99000,
          starts_at: iso('2023-04-06'),
          ends_at: iso('2025-04-06'),
          escalation: 'cpi',
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 2,
      incomes: [salary],
    })
    const out = run(cashflow)
    const outputIncomeYear = out.incomes[salary.id].years[0]
    const bands = outputIncomeYear.tax.bands

    expect(bands).toEqual({
      personal_allowance: { used: 12570, tax_paid: 0 },
      basic_rate_eng: { used: 37700, tax_paid: 7540 },
      higher_rate_eng: { used: 48730, tax_paid: 19492 },
    })
  })

  test('savings income taxed correctly', () => {
    const person = makePerson({ sex: 'female', tax_residency: 'eng' })
    const salary = makeIncome({
      id: v4(),
      people: [person],
      type: 'savings',
      values: [
        {
          value: 99000,
          starts_at: iso('2023-04-06'),
          ends_at: iso('2025-04-06'),
          escalation: 'cpi',
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 2,
      incomes: [salary],
    })
    const out = run(cashflow)
    const outputIncomeYear = out.incomes[salary.id].years[0]
    const bands = outputIncomeYear.tax.bands

    expect(bands).toEqual({
      personal_allowance: { used: 12570, tax_paid: 0 },
      basic_rate_eng: { used: 37700, tax_paid: 7540 },
      higher_rate_eng: { used: 48730, tax_paid: 19492 },
    })
  })
})
