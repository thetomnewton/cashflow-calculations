import { run } from '../src/calculations'
import { isAccount } from '../src/calculations/accounts'
import {
  makeAccount,
  makeCashflow,
  makeIncome,
  makeMoneyPurchase,
  makePerson,
} from '../src/factories'
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

    const sweep = cashflow.accounts.find(acc => isAccount(acc) && acc.is_sweep)
    expect(output.accounts[sweep?.id as string].years[0].end_value).toEqual(
      -1000
    )
  })

  test('personal contribution to money purchase is grossed up', () => {
    const person = makePerson({ date_of_birth: '1985-01-01', sex: 'female' })

    const salary = makeIncome({
      people: [person],
      values: [
        {
          value: 20000,
          starts_at: iso('2023-09-30'),
          ends_at: iso('2030-09-30'),
          escalation: 'cpi',
        },
      ],
    })

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          date: iso('2023-09-30'),
          value: 10000,
          uncrystallised_value: 10000,
          crystallised_value: 0,
        },
      ],
      growth_template: { type: 'flat', rate: { gross_rate: 0.05, charges: 0 } },
      contributions: [
        {
          type: 'personal',
          value: 2000,
          starts_at: iso('2023-09-30'),
          ends_at: iso('2025-09-30'),
          escalation: 'cpi',
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-09-30'),
      years: 2,
      accounts: [pension],
      incomes: [salary],
    })

    const output = run(cashflow)
    const [year0, year1] = output.accounts[pension.id].years

    expect(year0).toEqual({
      start_value: 10000,
      net_growth: 0.05,
    })

    expect(year1).toEqual({
      start_value: 10000,
      net_growth: 0.05,
    })
  })

  // basic band gets grossed up (england)
  // basic band gets grossed up (scotland)
  // only relevant individuals are applicable for tax relief
  // employer contributions don't get grossed up
})
