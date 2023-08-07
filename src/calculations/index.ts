import { clone } from 'lodash'
import { date } from '../lib/date'
import { Cashflow, Output } from '../types'
import { v4 } from 'uuid'

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
  output.years = [...Array(cashflow.years)].map((_, idx) => {
    const startDate = date(cashflow.starts_at)
    return {
      id: v4(),
      starts_at: clone(startDate).add(idx, 'year').toISOString(),
      ends_at: clone(startDate)
        .add(idx + 1, 'year')
        .toISOString(),
    }
  })
}

function initBands(cashflow: Cashflow, output: Output) {
  // initialise the tax bands on the output object
}

export function run(cashflow: Cashflow): Output {
  const output = makeInitOutput(cashflow)

  initYears(cashflow, output)
  initBands(cashflow, output)

  return output
}
