import { round } from 'lodash'
import { v4 } from 'uuid'
import { run } from '../src/calculations'
import {
  makeAccount,
  makeCashflow,
  makeExpense,
  makeMoneyPurchase,
  makePerson,
} from '../src/factories'
import { iso } from '../src/lib/date'
import { Account, Income } from '../src/types'

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

    const income = cashflow.incomes.find(i => i.source_id === cash.id)

    expect(income).not.toBe(undefined)
    expect(output.incomes[(income as Income).id].years[0]).toEqual({
      gross_value: 100,
      taxable_value: 0,
      net_value: 100,
      tax: { bands: {}, ni_paid: {} },
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
      years: 2,
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
    const person = makePerson({ date_of_birth: '1985-01-01' })

    const cash = makeAccount({
      category: 'cash',
      owner_id: person.id,
      valuations: [{ date: iso(), value: 175000 }],
      growth_template: { type: 'flat', rate: { gross_rate: 0.03, charges: 0 } },
      withdrawals: [
        {
          value: 5000,
          starts_at: iso(),
          ends_at: iso('2030-04-06'),
          escalation: 0.07,
        },
        {
          value: 12000,
          starts_at: iso('2025-04-06'),
          ends_at: iso('2030-04-06'),
          escalation: 0.06,
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-04-06'),
      years: 7,
      accounts: [cash],
    })

    const output = run(cashflow)

    let cvYear1 = 175000 - 5000
    expect(output.accounts[cash.id].years[0]).toEqual({
      start_value: 175000,
      current_value: cvYear1,
      end_value: round(cvYear1 * 1.03, 2),
      net_growth: 0.03,
    })

    let cvYear2 = round(175100 - 5000 * 1.07, 2)
    expect(output.accounts[cash.id].years[1]).toEqual({
      start_value: 175100,
      current_value: cvYear2,
      end_value: round(cvYear2 * 1.03, 2),
      net_growth: 0.03,
    })

    let cvYear3 = round(174842.5 - 5350 * 1.07 - 12000, 2)
    expect(output.accounts[cash.id].years[2]).toEqual({
      start_value: 174842.5,
      current_value: cvYear3,
      end_value: round(cvYear3 * 1.03, 2),
      net_growth: 0.03,
    })

    let cvYear4 = 142986.32 // 161831.54 - 5724.5 * 1.07 - 12720
    expect(output.accounts[cash.id].years[3]).toEqual({
      start_value: 161831.54,
      current_value: cvYear4,
      end_value: round(cvYear4 * 1.03, 2),
      net_growth: 0.03,
    })
  })

  test(`can make ufpls withdrawal from money purchase`, () => {
    const person = makePerson({ date_of_birth: '1980-03-04' })

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      growth_template: { type: 'flat', rate: { gross_rate: 0.05, charges: 0 } },
      valuations: [
        {
          uncrystallised_value: 150000,
          crystallised_value: 0,
          date: iso('2023-12-16'),
          value: 150000,
        },
      ],
      withdrawals: [
        {
          id: v4(),
          value: 15000,
          starts_at: iso('2023-12-16'),
          ends_at: iso('2028-12-16'),
          escalation: 'cpi',
          method: 'ufpls',
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-12-16'),
      years: 5,
      money_purchases: [pension],
    })

    const out = run(cashflow)

    expect(out.money_purchases[pension.id].years[0]).toEqual({
      start_value: 150000,
      start_value_uncrystallised: 150000,
      start_value_crystallised: 0,
      current_value: 135000,
      current_value_uncrystallised: 135000,
      current_value_crystallised: 0,
      end_value: 135000 * 1.05,
      end_value_uncrystallised: 135000 * 1.05,
      end_value_crystallised: 0,
      net_growth: 0.05,
    })

    expect(out.money_purchases[pension.id].years[1]).toEqual({
      start_value: 141750,
      start_value_uncrystallised: 141750,
      start_value_crystallised: 0,
      current_value: 141750 - 15000 * 1.025,
      current_value_uncrystallised: 141750 - 15000 * 1.025,
      current_value_crystallised: 0,
      end_value: (141750 - 15000 * 1.025) * 1.05,
      end_value_uncrystallised: (141750 - 15000 * 1.025) * 1.05,
      end_value_crystallised: 0,
      net_growth: 0.05,
    })

    const pa = out.tax.bands[2324][person.id].find(
      band => band.key === 'personal_allowance'
    )

    expect(pa?.remaining).toEqual(12570 - 11250)

    const basicBand = out.tax.bands[2324][person.id].find(
      band => band.key === 'basic_rate_eng'
    )

    expect(basicBand?.remaining).toEqual(37700)

    const withdrawalIncome = cashflow.incomes.find(
      inc => inc.source_id === pension.id && !inc.ad_hoc
    )

    expect(withdrawalIncome).not.toBeUndefined()

    const outIncomeYear = out.incomes[(withdrawalIncome as Income).id].years[0]
    expect(outIncomeYear.gross_value).toEqual(15000)
    expect(outIncomeYear.taxable_value).toEqual(15000 * 0.75) // only 75% taxable when UFPLS
    expect(outIncomeYear.tax.bands).toEqual({
      personal_allowance: { tax_paid: 0, used: 11250 },
    })
  })

  test(`can make pcls withdrawal from money purchase`, () => {
    const person = makePerson({ date_of_birth: '1960-12-20' })

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      growth_template: { type: 'flat', rate: { gross_rate: 0.05, charges: 0 } },
      valuations: [
        {
          uncrystallised_value: 150000,
          crystallised_value: 0,
          date: iso('2023-12-20'),
          value: 150000,
        },
      ],
      withdrawals: [
        {
          id: v4(),
          value: 40000,
          starts_at: iso('2023-12-20'),
          ends_at: iso('2024-12-20'),
          escalation: 'cpi',
          method: 'pcls',
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-12-20'),
      years: 5,
      money_purchases: [pension],
    })

    const out = run(cashflow)

    expect(out.money_purchases[pension.id].years[0]).toEqual({
      start_value: 150000,
      start_value_uncrystallised: 150000,
      start_value_crystallised: 0,
      current_value: 112500,
      current_value_uncrystallised: 0,
      current_value_crystallised: 112500,
      end_value: 118125,
      end_value_uncrystallised: 0,
      end_value_crystallised: 118125,
      net_growth: 0.05,
    })

    const pa = out.tax.bands[2324][person.id].find(
      band => band.key === 'personal_allowance'
    )

    expect(pa?.remaining).toEqual(12570)

    const basicBand = out.tax.bands[2324][person.id].find(
      band => band.key === 'basic_rate_eng'
    )

    expect(basicBand?.remaining).toEqual(37700)

    const withdrawalIncome = cashflow.incomes.find(
      inc => inc.source_id === pension.id && !inc.ad_hoc
    )

    expect(withdrawalIncome).not.toBeUndefined()

    const outIncomeYear = out.incomes[(withdrawalIncome as Income).id].years[0]
    expect(outIncomeYear.gross_value).toEqual(37500)
    expect(outIncomeYear.taxable_value).toEqual(0) // only 75% taxable when UFPLS
    expect(outIncomeYear.tax.bands).toEqual({})
  })

  test(`can make FAD withdrawal from money purchase`, () => {
    const person = makePerson({ date_of_birth: '1960-12-20' })

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      growth_template: { type: 'flat', rate: { gross_rate: 0.05, charges: 0 } },
      valuations: [
        {
          uncrystallised_value: 20000,
          crystallised_value: 80000,
          date: iso('2023-12-20'),
          value: 100000,
        },
      ],
      withdrawals: [
        {
          id: v4(),
          value: 38000,
          starts_at: iso('2023-12-20'),
          ends_at: iso('2024-12-20'),
          escalation: 'cpi',
          method: 'fad',
        },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2023-12-20'),
      years: 5,
      money_purchases: [pension],
    })

    const out = run(cashflow)

    expect(out.money_purchases[pension.id].years[0]).toEqual({
      start_value: 100000,
      start_value_uncrystallised: 20000,
      start_value_crystallised: 80000,
      current_value: 62000,
      current_value_uncrystallised: 20000,
      current_value_crystallised: 42000,
      end_value: 62000 * 1.05,
      end_value_uncrystallised: 20000 * 1.05,
      end_value_crystallised: 42000 * 1.05,
      net_growth: 0.05,
    })

    const pa = out.tax.bands[2324][person.id].find(
      band => band.key === 'personal_allowance'
    )

    expect(pa?.remaining).toEqual(0)

    const basicBand = out.tax.bands[2324][person.id].find(
      band => band.key === 'basic_rate_eng'
    )

    expect(basicBand?.remaining).toEqual(37700 - (38000 - 12570))

    const withdrawalIncome = cashflow.incomes.find(
      inc => inc.source_id === pension.id && !inc.ad_hoc
    )

    expect(withdrawalIncome).not.toBeUndefined()

    const outIncomeYear = out.incomes[(withdrawalIncome as Income).id].years[0]
    expect(outIncomeYear.gross_value).toEqual(38000)
    expect(outIncomeYear.taxable_value).toEqual(38000)
    expect(outIncomeYear.tax.bands).toEqual({
      personal_allowance: { used: 12570, tax_paid: 0 },
      basic_rate_eng: { used: 25430, tax_paid: 5086 },
    })
  })

  test('withdrawals starting in the future apply at the correct time', () => {
    //
  })

  // test withdrawal from a joint account by 1 person?
  // test withdrawals from other types of accounts e.g. ISA

  test('invalid withdrawal method throws error', () => {
    const person = makePerson({ date_of_birth: '1970-01-01' })

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          date: iso('2023-12-20'),
          value: 20000,
          uncrystallised_value: 20000,
          crystallised_value: 0,
        },
      ],
      growth_template: { type: 'flat', rate: { gross_rate: 0.03, charges: 0 } },
      withdrawals: [
        // @ts-ignore
        { value: 1000, method: 'fake_method' },
      ],
    })

    const cashflow = makeCashflow({
      people: [person],
      money_purchases: [pension],
    })

    try {
      run(cashflow)
    } catch (e) {
      expect(e.message).toEqual('Invalid money purchase withdrawal method')
    }
  })
})

describe('shortfall resolving', () => {
  test('correct gross withdrawal made from pension', () => {
    const person = makePerson({ date_of_birth: '1965-06-30' })

    const pension = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          value: 50000,
          uncrystallised_value: 50000,
          crystallised_value: 0,
          date: iso('2023-12-31'),
        },
      ],
      growth_template: { type: 'flat', rate: { gross_rate: 0.05, charges: 0 } },
    })

    const expense = makeExpense({
      people: [person],
      values: [
        {
          value: 20000,
          starts_at: iso('2023-12-31'),
          ends_at: iso('2028-12-31'),
          escalation: 'cpi',
        },
      ],
    })

    const cashflow = makeCashflow({
      starts_at: iso('2023-12-31'),
      years: 1,
      people: [person],
      money_purchases: [pension],
      expenses: [expense],
    })

    const out = run(cashflow)

    const sweep = cashflow.accounts.find(acc => acc.is_sweep)
    expect(out.accounts[(sweep as Account).id].years[0]).toEqual({
      start_value: 0,
      current_value: 0,
      net_growth: 0.005,
      end_value: 0,
    })

    expect(out.expenses[expense.id].years[0].value).toEqual(20000)

    expect(out.money_purchases[pension.id].years[0].start_value).toEqual(50000)

    /**
     * 20k ad-hoc withdrawal would not be enough to cover the 20k shortfall
     * due to tax, so need to establish the correct gross withdrawal.
     * By rearranging the equation, 20571.76 is correct withdrawal
     */
    const income = cashflow.incomes.find(
      inc => inc.ad_hoc && inc.source_id === pension.id
    ) as Income

    expect(out.incomes[income.id].years[0]).toEqual({
      gross_value: 20571.76,
      taxable_value: 20571.76 * 0.75, // 15428.82
      net_value: 20000,
      tax: {
        ni_paid: {},
        bands: {
          personal_allowance: { used: 12570, tax_paid: 0 },
          basic_rate_eng: { used: 15428.82 - 12570, tax_paid: 571.764 },
        },
      },
    })
  })
})
