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
    //
  })

  test('salary above LPL taxed via class1', () => {
    //
  })

  test('salary above UPL taxed appropriately with class1', () => {
    //
  })

  test('self employed below LPL no NICs', () => {
    //
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
