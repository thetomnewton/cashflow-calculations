import { clone } from 'lodash'
import { date } from '../lib/date'
import { Cashflow, Income, Output } from '../types'
import { generateBandsFor, getTaxYearFromDate } from './income-tax'
import { getValueInYear } from './entity'

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
          start: { in_drawdown: false },
          end: { in_drawdown: false },
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
    years: output.years.map(year => {
      const grossValue = getValueInYear(income, year, cashflow, output)
      return {
        gross_value: grossValue,
        taxable_value: 0,
        net_value: 0,
        tax: {
          ni_paid: {},
          bands: {},
        },
      }
    }),
  }
}

function initIncomes(cashflow: Cashflow, output: Output) {
  cashflow.incomes.forEach(income => {
    output.incomes[income.id] = makeOutputIncomeObj(income, cashflow, output)
  })
}

function initAccounts(cashflow: Cashflow, output: Output) {
  cashflow.accounts.forEach(account => {
    output.accounts[account.id] = {
      years: output.years.map((year, idx) => {
        return {
          start_value: undefined,
          current_value: undefined,
          end_value: undefined,
          growth: undefined,
        }
      }),
    }
  })
}
