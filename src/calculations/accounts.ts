import { round } from 'lodash'
import { Account, Cashflow, Output, PlanningYear } from '../types'
import { getYearIndex } from './income-tax'
import { applyGrowth as applyGrowthRate } from './growth'

let yearIndex: number

export function initialiseAccounts(
  year: PlanningYear,
  cashflow: Cashflow,
  output: Output
) {
  yearIndex = getYearIndex(year.tax_year, output)

  cashflow.accounts.forEach(account => {
    const outputYear = output.accounts[account.id].years[yearIndex]

    // If the year index is 0, get the value from the base account valuations.
    // If it's not, get it from the previous year's end value.
    if (yearIndex === 0) {
      outputYear.start_value = account.valuations[0].value
    } else {
      outputYear.start_value =
        output.accounts[account.id].years[yearIndex - 1].end_value
    }

    outputYear.current_value = outputYear.start_value
    outputYear.growth = getGrowthRateFromTemplate(account)
  })
}

function getGrowthRateFromTemplate(account: Account) {
  if (account.growth_template.type === 'flat') {
    return round(
      account.growth_template.rate.gross_rate -
        (account.growth_template.rate.charges ?? 0),
      4
    )
  }

  // todo: Handle non-flat growth template
  return 0
}

export function applyGrowth(cashflow: Cashflow, output: Output) {
  cashflow.accounts.forEach(account => {
    const outputYear = output.accounts[account.id].years[yearIndex]

    const endValue =
      (outputYear.current_value ?? 0) *
      applyGrowthRate(
        0.025,
        cashflow.assumptions.terms === 'real' ? cashflow.assumptions.cpi : 0
      )

    outputYear.end_value = round(endValue, 2)
  })
}
