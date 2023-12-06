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

  test(`can't withdraw more than the remaining ongoing account value`, () => {
    const person = makePerson({ date_of_birth: '1965-11-13', sex: 'female' })

    const cash = makeAccount({
      category: 'cash',
      owner_id: person.id,
      valuations: [{ date: iso(), value: 16123 }],
      growth_template: { type: 'flat', rate: { gross_rate: 0.05, charges: 0 } },
      withdrawals: [
        {
          value: 18000,
          starts_at: iso(),
          ends_at: iso('2024-12-01'),
          escalation: 0,
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-12-01'),
      years: 1,
      accounts: [cash],
    })

    const output = run(cashflow)

    expect(output.accounts[cash.id].years[0]).toEqual({
      start_value: 16123,
      current_value: 0,
      end_value: 0,
      net_growth: 0.05,
    })
  })

  test(`ongoing withdrawal escalates correctly`, () => {
    const person = makePerson({ date_of_birth: '1950-09-04', sex: 'female' })

    const cash = makeAccount({
      category: 'cash',
      owner_id: person.id,
      valuations: [{ date: iso(), value: 175123 }],
      growth_template: { type: 'flat', rate: { gross_rate: 0.05, charges: 0 } },
      withdrawals: [
        {
          value: 12121,
          starts_at: iso(),
          ends_at: iso('2028-12-31'),
          escalation: 'rpi',
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-12-31'),
      years: 5,
      accounts: [cash],
      assumptions: { rpi: 0.035 },
    })

    const output = run(cashflow)

    expect(output.accounts[cash.id].years[0]).toEqual({
      start_value: 175123,
      current_value: 175123 - 12121,
      end_value: (175123 - 12121) * 1.05,
      net_growth: 0.05,
    })

    expect(output.accounts[cash.id].years[1]).toEqual({
      start_value: 171152.1, // (175123 - 12121) * 1.05
      current_value: 158606.86, // 171152.1 - 12121 * 1.035 (roughly)
      end_value: 166537.2, // 158606.86 * 1.05
      net_growth: 0.05,
    })
  })

  test(`multiple withdrawals from same account both apply`, () => {
    //
  })

  test(`can make withdrawals from DC pension`, () => {
    //
  })

  // test withdrawal from a joint account by 1 person?
  // test withdrawals from other types of accounts e.g. ISA
  // test nothing happens with gross withdrawal of 0 or less
})
