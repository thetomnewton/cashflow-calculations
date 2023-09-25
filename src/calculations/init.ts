import { clone } from 'lodash'
import { date, iso } from '../lib/date'
import { Account, Cashflow, Income, Output, Person } from '../types'
import { generateBandsFor, getTaxYearFromDate } from './income-tax'
import { getValueInYear } from './entity'
import { v4 } from 'uuid'
import { isAccount } from './accounts'

export function initialise(cashflow: Cashflow) {
  const output = makeInitOutput(cashflow)

  initYears(cashflow, output)
  initBands(cashflow, output)
  initIncomes(cashflow, output)
  initAccounts(cashflow, output)

  return output
}

function makeInitOutput(cashflow: Cashflow): Output {
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
    tax: {
      bands: {},
    },
    incomes: {},
    accounts: {},
  }
}

function initYears(cashflow: Cashflow, output: Output) {
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

function initBands(cashflow: Cashflow, output: Output) {
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

function makeOutputIncomeObj(
  income: Income,
  cashflow: Cashflow,
  output: Output
) {
  return {
    years: output.years.map(year => ({
      gross_value: getValueInYear(income, year, cashflow, output),
      taxable_value: 0,
      net_value: 0,
      tax: { ni_paid: {}, bands: {} },
    })),
  }
}

function initIncomes(cashflow: Cashflow, output: Output) {
  cashflow.incomes.forEach(income => {
    output.incomes[income.id] = makeOutputIncomeObj(income, cashflow, output)
  })
}

function initAccounts(cashflow: Cashflow, output: Output) {
  ensureSweepAccountExists(cashflow)

  cashflow.accounts.forEach(account => {
    output.accounts[account.id] = {
      years: output.years.map(_ => ({
        start_value: undefined,
        current_value: undefined,
        end_value: undefined,
        net_growth: undefined,
      })),
    }
  })
}

function ensureSweepAccountExists(cashflow: Cashflow) {
  // Check if the person has a sweep account. If not, create one.
  const sweep = cashflow.accounts.find(acc => 'is_sweep' in acc && acc.is_sweep)
  if (!sweep) cashflow.accounts.push(createSweepAccount(cashflow.people))
}

function createSweepAccount(people: Person[]): Account {
  return {
    id: v4(),
    category: 'cash',
    owner_id: people.map(({ id }) => id),
    is_sweep: true,
    valuations: [{ value: 0, date: iso() }],
    contributions: [],
    growth_template: {
      type: 'flat',
      rate: { gross_rate: 0.005, charges: 0 },
    },
  }
}
