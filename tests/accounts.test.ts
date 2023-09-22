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
      years: 2,
      accounts: [account],
    })
    const out = run(cashflow)

    const [year1, year2] = out.accounts[account.id].years

    expect(year1).toEqual({
      start_value: 10000,
      current_value: 10000,
      end_value: 10250,
      growth: 0.025,
    })

    expect(year2).toEqual({
      start_value: 10250,
      current_value: 10250,
      end_value: 10506.25,
      growth: 0.025,
    })
  })

  test('money purchase initialises correctly (real terms, 2.5%)', () => {
    const person = makePerson({ sex: 'female', date_of_birth: '1960-01-01' })

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
      assumptions: { terms: 'real', cpi: 0.025 },
    })
    const out = run(cashflow)

    const outputAccountYear = out.accounts[account.id].years[0]

    expect(outputAccountYear).toEqual({
      start_value: 10000,
      current_value: 10000,
      end_value: 10000,
      growth: 0.025,
    })
  })

  test('money purchase initialises correctly (real terms, 4 CPI%)', () => {
    const person = makePerson({ sex: 'female', date_of_birth: '1960-01-01' })

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
      assumptions: { terms: 'real', cpi: 0.04 },
    })
    const out = run(cashflow)

    const outputAccountYear = out.accounts[account.id].years[0]

    expect(outputAccountYear).toEqual({
      start_value: 10000,
      current_value: 10000,
      end_value: 9855.77,
      growth: 0.025,
    })
  })
})
