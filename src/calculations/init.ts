import { v4 } from 'uuid'
import { clone } from 'lodash'
import { date } from '../lib/date'
import { Cashflow, Income, Output } from '../types'
import { getTaxYearFromDate } from '../config/income-tax'

export function makeInitOutput(cashflow: Cashflow): Output {
  return {
    starts_at: cashflow.starts_at,
    years: [],
    tax: {
      bands: {},
    },
    incomes: {},
  }
}

export function initYears(cashflow: Cashflow, output: Output) {
  output.years = [...Array(cashflow.years)].map((_, idx) => {
    const startDate = date(cashflow.starts_at)
    return {
      id: v4(),
      tax_year: getTaxYearFromDate(startDate),
      starts_at: clone(startDate).add(idx, 'year').toISOString(),
      ends_at: clone(startDate)
        .add(idx + 1, 'year')
        .toISOString(),
    }
  })
}

export function initBands(cashflow: Cashflow, output: Output) {
  // initialise the tax bands on the output object
  // if the rates are not yet known, project them forwards
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

export function initIncomes(cashflow: Cashflow, output: Output) {
  cashflow.incomes.forEach(income => {
    output.incomes[income.id] = makeOutputIncomeObj(income, output)
  })
}
