import { makeCashflow, makePerson, makeMoneyPurchase } from '../src/factories'
import { iso } from '../src/lib/date'
import { run } from '../src/calculations'

describe('accounts', () => {
  test('money purchase initialises correctly', () => {
    const person = makePerson({ sex: 'male', date_of_birth: '1980-01-01' })

    const account = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [{ date: '2023-04-06', value: 10000 }],
      growth_template: { type: 'flat', rate: { gross_rate: 0.025 } },
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 5,
      accounts: [account],
    })
    const out = run(cashflow)

    const outputAccountYear = out.accounts[account.id].years[0]

    expect(outputAccountYear).toEqual({
      start_value: 10000,
      end_value: 10250,
      growth: 0.025,
    })
  })
})
