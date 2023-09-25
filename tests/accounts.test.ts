import {
  makeCashflow,
  makePerson,
  makeMoneyPurchase,
  makeAccount,
  makeISA,
} from '../src/factories'
import { iso } from '../src/lib/date'
import { run } from '../src/calculations'

describe('accounts', () => {
  test('sweep account exists automatically', () => {
    const person = makePerson({ sex: 'male', date_of_birth: '1980-01-01' })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 1,
    })
    const out = run(cashflow)

    const keys = Object.keys(out.accounts)
    expect(keys).toHaveLength(1)

    expect(out.accounts[keys[0]].years[0]).toEqual({
      current_value: 0,
      start_value: 0,
      end_value: 0,
      net_growth: 0.005,
    })
  })

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
      net_growth: 0.025,
    })

    expect(year2).toEqual({
      start_value: 10250,
      current_value: 10250,
      end_value: 10506.25,
      net_growth: 0.025,
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
      years: 1,
      accounts: [account],
      assumptions: { terms: 'real', cpi: 0.025 },
    })
    const out = run(cashflow)

    const outputAccountYear = out.accounts[account.id].years[0]

    expect(outputAccountYear).toEqual({
      start_value: 10000,
      current_value: 10000,
      end_value: 10000,
      net_growth: 0.025,
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
      years: 1,
      accounts: [account],
      assumptions: { terms: 'real', cpi: 0.04 },
    })
    const out = run(cashflow)

    const outputAccountYear = out.accounts[account.id].years[0]

    expect(outputAccountYear).toEqual({
      start_value: 10000,
      current_value: 10000,
      end_value: 9855.77,
      net_growth: 0.025,
    })
  })

  test('only 1 sweep account per person', () => {
    const person = makePerson({ sex: 'female', date_of_birth: '1960-01-01' })

    const account = makeAccount({
      is_sweep: true,
      category: 'cash',
      owner_id: person.id,
      valuations: [{ date: '2023-04-06', value: 0 }],
      growth_template: {
        type: 'flat',
        rate: { gross_rate: 0.005, charges: 0 },
      },
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 1,
      accounts: [account],
    })
    const out = run(cashflow)

    expect(Object.keys(out.accounts)).toHaveLength(1)
  })

  test('multiple non-sweep cash accounts can be added', () => {
    const person = makePerson({ sex: 'female', date_of_birth: '1960-01-01' })

    const account1 = makeAccount({
      category: 'cash',
      owner_id: person.id,
      valuations: [{ date: '2023-04-06', value: 1000 }],
      growth_template: {
        type: 'flat',
        rate: { gross_rate: 0.01, charges: 0 },
      },
    })

    const account2 = makeAccount({
      category: 'cash',
      owner_id: person.id,
      valuations: [{ date: '2023-04-06', value: 2000 }],
      growth_template: {
        type: 'flat',
        rate: { gross_rate: 0.015, charges: 0 },
      },
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 1,
      accounts: [account1, account2],
    })
    const out = run(cashflow)

    expect(out.accounts[account1.id].years[0]).toEqual({
      start_value: 1000,
      current_value: 1000,
      end_value: 1010,
      net_growth: 0.01,
    })

    expect(out.accounts[account2.id].years[0]).toEqual({
      start_value: 2000,
      current_value: 2000,
      end_value: 2030,
      net_growth: 0.015,
    })

    const sweep = cashflow.accounts.find(
      account => account.category === 'cash' && !!account.is_sweep
    )

    expect(sweep).not.toBeUndefined()

    const sweepId = sweep?.id as string
    expect(sweepId).not.toBe(account1.id)
    expect(sweepId).not.toBe(account2.id)
    expect(out.accounts[sweepId].years[0]).toEqual({
      start_value: 0,
      current_value: 0,
      end_value: 0,
      net_growth: 0.005,
    })
  })

  test('sweep account is assigned to both people in a joint case', () => {
    const person1 = makePerson({ sex: 'female', date_of_birth: '1965-01-01' })
    const person2 = makePerson({ sex: 'female', date_of_birth: '1962-01-01' })

    const cashflow = makeCashflow({
      people: [person1, person2],
      starts_at: iso('2023-04-06'),
      years: 1,
    })
    const out = run(cashflow)

    expect(cashflow.accounts).toHaveLength(1)
    expect(cashflow.accounts[0].is_sweep).toBe(true)
    expect(cashflow.accounts[0].owner_id).toEqual([person1.id, person2.id])
    expect(out.accounts[cashflow.accounts[0].id].years[0]).toEqual({
      start_value: 0,
      current_value: 0,
      end_value: 0,
      net_growth: 0.005,
    })
  })

  test('Cash ISA can be added', () => {
    const person = makePerson({ date_of_birth: '1970-01-01', sex: 'male' })

    const isa = makeISA({
      category: 'isa',
      sub_category: 'cash_isa',
      owner_id: person.id,
      valuations: [{ date: iso(), value: 15000 }],
      growth_template: {
        type: 'flat',
        rate: { gross_rate: 0.05, charges: 0 },
      },
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 1,
      accounts: [isa],
    })
    const out = run(cashflow)

    expect(out.accounts[isa.id].years[0]).toEqual({
      start_value: 15000,
      current_value: 15000,
      end_value: 15750,
      net_growth: 0.05,
    })
  })

  test('non-flat growth template calculates correctly', () => {
    const person = makePerson({ date_of_birth: '1980-05-01', sex: 'female' })

    const cash1 = makeAccount({
      category: 'cash',
      owner_id: person.id,
      valuations: [
        {
          date: iso('2023-08-01'),
          value: 10000,
        },
      ],
      growth_template: {
        type: 'array',
        rate: [
          { gross_rate: 0.03, charges: 0.01 },
          { gross_rate: 0.05, charges: 0.005 },
        ],
      },
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-08-01'),
      years: 4,
      accounts: [cash1],
    })

    const output = run(cashflow)

    expect(output.accounts[cash1.id].years[0]).toEqual({
      start_value: 10000,
      current_value: 10000,
      end_value: 10200,
      net_growth: 0.02,
    })

    expect(output.accounts[cash1.id].years[1]).toEqual({
      start_value: 10200,
      current_value: 10200,
      end_value: 10659,
      net_growth: 0.045,
    })
  })
})
