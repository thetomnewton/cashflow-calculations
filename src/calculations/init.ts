import { clone } from 'lodash'
import { v4 } from 'uuid'
import { date, iso } from '../lib/date'
import {
  Account,
  Cashflow,
  EntityValue,
  Expense,
  Income,
  MoneyPurchase,
  Output,
  OutputIncomeYear,
  Person,
} from '../types'
import { isAccount } from './accounts'
import { findActiveEntityValue, getValueInYear } from './entity'
import { generateBandsFor, getTaxYearFromDate } from './income-tax'
import { getTaxableValue, isEmployment } from './incomes'

let cashflow: Cashflow
let output: Output

export function initialise(baseCashflow: Cashflow) {
  cashflow = baseCashflow
  output = makeInitOutput()

  initYears()
  initBands()
  initAccounts()
  initMoneyPurchases()
  initDefinedBenefits()
  initIncomes()
  initExpenses()

  return output
}

function makeInitOutput(): Output {
  return {
    starts_at: cashflow.starts_at,
    years: [],
    people: Object.fromEntries(
      cashflow.people.map(person => [
        person.id,
        {
          start: { in_drawdown: person.in_drawdown },
          end: { in_drawdown: person.in_drawdown },
        },
      ])
    ),
    tax: { bands: {} },
    incomes: {},
    expenses: {},
    accounts: {},
    money_purchases: {},
  }
}

function initYears() {
  const startDate = date(cashflow.starts_at)
  output.years = [...Array(cashflow.years)].map((_, idx) => {
    const yearStartDate = clone(startDate).add(idx, 'year')
    return {
      tax_year: getTaxYearFromDate(yearStartDate),
      starts_at: yearStartDate.toISOString(),
      ends_at: yearStartDate.add(1, 'year').toISOString(),
    }
  })
}

function initBands() {
  output.years.forEach(year => {
    output.tax.bands[year.tax_year] = {}
    cashflow.people.forEach(person => {
      output.tax.bands[year.tax_year][person.id] = generateBandsFor(
        person,
        year.tax_year,
        cashflow.assumptions
      )
    })
  })
}

/**
 * Initialise an output income object. Many of the values would
 * not yet be calculated at this stage of the calculation
 * lifecycle.
 */
export function makeOutputIncomeObj(
  income: Income,
  cashflow: Cashflow,
  output: Output
): { years: OutputIncomeYear[] } {
  return {
    years: output.years.map(year => {
      const entityValue = findActiveEntityValue(income, year)

      const out: OutputIncomeYear = {
        gross_value: entityValue
          ? getValueInYear(entityValue, year, cashflow, output)
          : 0,
        taxable_value: 0,
        net_value: 0,
        tax: { ni_paid: {}, bands: {} },
      }

      if (isEmployment(income)) {
        out.bonus = entityValue
          ? getValueInYear(entityValue, year, cashflow, output, 'bonus')
          : 0
        out.benefits = entityValue
          ? getValueInYear(entityValue, year, cashflow, output, 'benefits')
          : 0
      }

      return out
    }),
  }
}

function initIncomes() {
  cashflow.incomes.forEach(income => {
    // Make an initial output income object
    output.incomes[income.id] = makeOutputIncomeObj(income, cashflow, output)

    // Set the income's taxable value
    output.incomes[income.id].years.forEach(year => {
      year.taxable_value = getTaxableValue(income, year, cashflow)
    })
  })
  console.log(output.incomes)
}

function initExpenses() {
  cashflow.expenses.forEach(initExpenseOutput)
}

export function initExpenseOutput(expense: Expense) {
  output.expenses[expense.id] = {
    years: output.years.map(year => {
      const entityValue = findActiveEntityValue(expense, year)

      const value = entityValue
        ? getValueInYear(entityValue, year, cashflow, output)
        : 0

      return { value }
    }),
  }
}

export function makeAccountOutputObject(account: Account, output: Output) {
  output.accounts[account.id] = {
    years: output.years.map(_ => ({
      start_value: undefined,
      current_value: undefined,
      end_value: undefined,
      net_growth: undefined,
    })),
  }
}

export function makeMoneyPurchaseOutputObject(
  pension: MoneyPurchase,
  output: Output
) {
  output.money_purchases[pension.id] = {
    years: output.years.map(_ => ({
      start_value: undefined,
      start_value_crystallised: undefined,
      start_value_uncrystallised: undefined,
      current_value: undefined,
      current_value_crystallised: undefined,
      current_value_uncrystallised: undefined,
      end_value: undefined,
      end_value_crystallised: undefined,
      end_value_uncrystallised: undefined,
      net_growth: undefined,
    })),
  }
}

function initAccounts() {
  ensureSweepAccountExists()

  cashflow.accounts.forEach(account => {
    makeAccountOutputObject(account, output)

    account.withdrawals.forEach(withdrawal => {
      cashflow.incomes.push({
        id: v4(),
        people: getAccountOwners(account.owner_id),
        values: [],
        type: 'other_non_taxable', // todo: update based on account/withdrawal type
        source_id: account.id,
        source_withdrawal_id: withdrawal.id,
      })
    })
  })
}

function initMoneyPurchases() {
  cashflow.money_purchases.forEach(pension => {
    makeMoneyPurchaseOutputObject(pension, output)

    pension.withdrawals.forEach(withdrawal => {
      cashflow.incomes.push({
        id: v4(),
        people: getAccountOwners(pension.owner_id),
        values: [],
        type: 'pension',
        source_id: pension.id,
        source_withdrawal_id: withdrawal.id,
        ad_hoc: false,
      })
    })

    cashflow.incomes.push({
      id: v4(),
      people: getAccountOwners(pension.owner_id),
      values: [],
      type: 'pension',
      source_id: pension.id,
      ad_hoc: true,
    })
  })
}

function initDefinedBenefits() {
  cashflow.defined_benefits.forEach(db => {
    const values: EntityValue[] = []

    if (db.status === 'deferred') {
      values.push({
        value: 10000,
        escalation: db.active_escalation_rate,
        starts_at: db.starts_at,
        ends_at: date(db.starts_at).add(cashflow.years, 'year').toISOString(),
      })
    }

    cashflow.incomes.push({
      id: v4(),
      people: getAccountOwners(db.owner_id),
      type: 'pension',
      source_id: db.id,
      values,
    })
  })
}

function ensureSweepAccountExists() {
  // Check if the person has a sweep account. If not, create one.
  const sweep = cashflow.accounts.find(acc => isAccount(acc) && acc.is_sweep)
  if (!sweep) cashflow.accounts.push(createSweepAccount(cashflow.people))
}

function createSweepAccount(people: Person[]): Account {
  return {
    id: v4(),
    section: 'accounts',
    category: 'cash',
    owner_id: people.map(({ id }) => id),
    is_sweep: true,
    valuations: [{ value: 0, date: iso() }],
    contributions: [],
    withdrawals: [],
    growth_template: {
      type: 'flat',
      rate: { gross_rate: 0.005, charges: 0 },
    },
  }
}

function getAccountOwners(ownerId: string | string[]) {
  return cashflow.people.filter(
    ({ id }) =>
      id === ownerId || (Array.isArray(ownerId) && ownerId.includes(id))
  )
}
