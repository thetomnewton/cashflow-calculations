import { run } from '../src/calculations'
import { makeAccount, makeCashflow, makePerson } from '../src/factories'
import { iso } from '../src/lib/date'

describe('contributions', () => {
  test('can make a personal contribution to a cash account', () => {
    const person = makePerson({ date_of_birth: '1985-01-01', sex: 'female' })

    const cash1 = makeAccount({
      category: 'cash',
      owner_id: person.id,
      valuations: [{ date: iso(), value: 1000 }],
      growth_template: { type: 'flat', rate: { gross_rate: 0.05, charges: 0 } },
      contributions: [
        {
          type: 'personal',
          value: 1000,
          starts_at: iso(),
          ends_at: iso('2025-04-06'),
          escalation: 'cpi',
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 1,
      accounts: [cash1],
    })
    const output = run(cashflow)

    expect(output.accounts[cash1.id].years[0].end_value).toEqual(2100)

    const sweep = cashflow.accounts.find(acc => acc.is_sweep)
    expect(output.accounts[sweep?.id as string].years[0].end_value).toEqual(
      -1000
    )
  })

  test('contribution to money purchase is grossed up', () => {
    //
  })
})
