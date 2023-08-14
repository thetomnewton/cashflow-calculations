import { v4 } from 'uuid'
import { run } from '../src/calculations'
import { makeCashflow, makeIncome, makePerson } from '../src/factories'

describe('national insurance', () => {
  test('salary below threshold has no NI to pay', () => {
    const person = makePerson({ date_of_birth: '1980-01-01', sex: 'male' })
    const salaryId = v4()
    const cashflow = makeCashflow({
      starts_at: '2023-08-13',
      years: 3,
      people: [person],
      incomes: [
        makeIncome({
          id: salaryId,
          type: 'employment',
          people: [person],
          values: [
            {
              value: 10000,
              starts_at: '2023-08-13',
              ends_at: '2026-08-13',
              adjusted: true,
              escalation: 'cpi',
            },
          ],
        }),
      ],
    })

    const out = run(cashflow)

    expect(out.incomes[salaryId].years[0].tax.ni_paid.class1).toEqual(0)
    expect(out.incomes[salaryId].years[1].tax.ni_paid.class1).toEqual(0)
    expect(out.incomes[salaryId].years[2].tax.ni_paid.class1).toEqual(0)
  })

  test('under 16 no NICs', () => {
    const person = makePerson({ date_of_birth: '2013-01-01', sex: 'male' })
    const salaryId = v4()
    const cashflow = makeCashflow({
      starts_at: '2023-08-13',
      years: 3,
      people: [person],
      incomes: [
        makeIncome({
          id: salaryId,
          type: 'employment',
          people: [person],
          values: [
            {
              value: 20000,
              starts_at: '2023-08-13',
              ends_at: '2026-08-13',
              adjusted: true,
              escalation: 'cpi',
            },
          ],
        }),
      ],
    })

    const out = run(cashflow)

    expect(out.incomes[salaryId].years[0].tax.ni_paid).toStrictEqual({})
    expect(out.incomes[salaryId].years[1].tax.ni_paid).toStrictEqual({})
    expect(out.incomes[salaryId].years[2].tax.ni_paid).toStrictEqual({})
  })

  test('over state pension age no NICs', () => {
    const person = makePerson({ date_of_birth: '1933-01-01', sex: 'male' })
    const salaryId = v4()
    const cashflow = makeCashflow({
      starts_at: '2023-08-13',
      years: 3,
      people: [person],
      incomes: [
        makeIncome({
          id: salaryId,
          type: 'employment',
          people: [person],
          values: [
            {
              value: 50000,
              starts_at: '2023-08-13',
              ends_at: '2026-08-13',
              adjusted: true,
              escalation: 'cpi',
            },
          ],
        }),
      ],
    })

    const out = run(cashflow)

    expect(out.incomes[salaryId].years[0].tax.ni_paid).toStrictEqual({})
    expect(out.incomes[salaryId].years[1].tax.ni_paid).toStrictEqual({})
    expect(out.incomes[salaryId].years[2].tax.ni_paid).toStrictEqual({})
  })

  test('salary above LPL taxed via class1', () => {
    const person = makePerson({ date_of_birth: '1980-07-30', sex: 'female' })
    const salaryId = v4()
    const cashflow = makeCashflow({
      starts_at: '2023-08-13',
      years: 3,
      people: [person],
      incomes: [
        makeIncome({
          id: salaryId,
          type: 'employment',
          people: [person],
          values: [
            {
              value: 40000,
              starts_at: '2023-08-13',
              ends_at: '2026-08-13',
              adjusted: true,
              escalation: 'cpi',
            },
          ],
        }),
      ],
    })

    const out = run(cashflow)

    expect(out.incomes[salaryId].years[0].tax.ni_paid.class1).toEqual(3291.6)
    expect(out.incomes[salaryId].years[1].tax.ni_paid.class1).toEqual(3373.89)
    expect(out.incomes[salaryId].years[2].tax.ni_paid.class1).toEqual(3458.24)
  })

  test('salary above UPL taxed appropriately with class1', () => {
    const person = makePerson({ date_of_birth: '1965-10-10', sex: 'male' })
    const salaryId = v4()
    const cashflow = makeCashflow({
      starts_at: '2023-08-13',
      years: 3,
      people: [person],
      incomes: [
        makeIncome({
          id: salaryId,
          type: 'employment',
          people: [person],
          values: [
            {
              value: 60000,
              starts_at: '2023-08-13',
              ends_at: '2026-08-13',
              adjusted: true,
              escalation: 'cpi',
            },
          ],
        }),
      ],
    })

    const out = run(cashflow)

    expect(out.incomes[salaryId].years[0].tax.ni_paid.class1).toEqual(4718.6)
    expect(out.incomes[salaryId].years[1].tax.ni_paid.class1).toEqual(4836.57)
    expect(out.incomes[salaryId].years[2].tax.ni_paid.class1).toEqual(4957.48)
  })

  test('self employed below LPL no NICs', () => {
    const person = makePerson({ date_of_birth: '1991-09-01', sex: 'female' })
    const salaryId = v4()
    const cashflow = makeCashflow({
      starts_at: '2023-08-13',
      years: 3,
      people: [person],
      incomes: [
        makeIncome({
          id: salaryId,
          type: 'self_employment',
          people: [person],
          values: [
            {
              value: 75000,
              starts_at: '2023-08-13',
              ends_at: '2026-08-13',
              escalation: 0,
            },
          ],
        }),
      ],
    })

    const out = run(cashflow)

    expect(out.incomes[salaryId].years[0].tax.ni_paid).toStrictEqual({
      class2: 163.8,
      class4: 3887.6, // 37700 * 0.09 + 24730 * 0.02
    })
    expect(out.incomes[salaryId].years[1].tax.ni_paid).toStrictEqual({
      class2: 167.9,
      class4: 0,
    })
    expect(out.incomes[salaryId].years[2].tax.ni_paid).toStrictEqual({
      class2: 0,
      class4: 0,
    })
  })

  test('self-employed pays both class2 and class4', () => {
    //
  })

  test('NIC thresholds project forward (nominal terms)', () => {
    //
  })

  test('NIC thresholds project forward (real terms)', () => {
    //
  })
})
