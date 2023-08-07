import { clone } from 'lodash'
import { date } from '../lib/date'
import { Cashflow, Income, Output } from '../types'
import { generateBandsFor, getTaxYearFromDate } from './income-tax'

export function initialise(cashflow: Cashflow) {
  const output = makeInitOutput(cashflow)

  initYears(cashflow, output)
  initBands(cashflow, output)
  initIncomes(cashflow, output)

  return output
}

function makeInitOutput(cashflow: Cashflow): Output {
  return {
    starts_at: cashflow.starts_at,
    years: [],
    tax: {
      bands: {},
    },
    incomes: {},
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

function makeOutputIncomeObj(income: Income, output: Output) {
  return {
    year: output.years.map(year => ({
      gross_value: 0,
      net_value: 0,
      tax: {
        tax_paid: 0,
        ni_paid: 0,
        bands: {},
      },
    })),
  }
}

function initIncomes(cashflow: Cashflow, output: Output) {
  cashflow.incomes.forEach(income => {
    output.incomes[income.id] = makeOutputIncomeObj(income, output)
  })
}
