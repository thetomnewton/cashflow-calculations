import { run } from '../src/calculations'
import { makeAccount, makeCashflow, makePerson } from '../src/factories'
import { iso } from '../src/lib/date'

describe('planned withdrawals', () => {
  test('can make withdrawal from cash account', () => {
    const person = makePerson({ date_of_birth: '1985-01-01' })

    const cash = makeAccount({
      category: 'cash',
      owner_id: person.id,
      valuations: [{ date: iso(), value: 1000 }],
      growth_template: { type: 'flat', rate: { gross_rate: 0.05, charges: 0 } },
      withdrawals: [
        {
          value: 100,
          starts_at: iso(),
          ends_at: iso('2024-04-06'),
          escalation: 0,
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 1,
      accounts: [cash],
    })

    const output = run(cashflow)

    expect(output.accounts[cash.id].years[0]).toEqual({
      start_value: 1000,
      current_value: 1000 - 100,
      end_value: (1000 - 100) * 1.05,
      net_growth: 0.05,
    })
  })

  test(`can't withdraw more than the remaining ongoing account value`, () => {})

  test(`ongoing withdrawal escalates correctly`, () => {})

  test(`multiple withdrawals from same account both apply`, () => {})

  test(`can make withdrawals from DC pension`, () => {})

  // test withdrawal from a joint account by 1 person?
})
