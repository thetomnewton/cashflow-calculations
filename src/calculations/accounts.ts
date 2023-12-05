import { round } from 'lodash'
import {
  Account,
  BaseAccount,
  Cashflow,
  MoneyPurchase,
  Output,
  PlanningYear,
} from '../types'
import { applyGrowth as applyGrowthRate } from './growth'
import { getYearIndex } from './income-tax'

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
    outputYear.net_growth = getGrowthRateFromTemplate(account)
  })
}

function getGrowthRateFromTemplate(account: BaseAccount) {
  if (account.growth_template.type === 'flat') {
    return round(
      account.growth_template.rate.gross_rate -
        (account.growth_template.rate.charges ?? 0),
      4
    )
  }

  const item =
    account.growth_template.rate[
      yearIndex % account.growth_template.rate.length
    ]

  return round(item.gross_rate - (item.charges ?? 0), 4)
}

export function applyGrowth(cashflow: Cashflow, output: Output) {
  cashflow.accounts.forEach(account => {
    const outputYear = output.accounts[account.id].years[yearIndex]

    const currentValue = outputYear.current_value ?? 0
    const growthRate = currentValue < 0 ? 0 : getGrowthRateFromTemplate(account)

    const endValue =
      currentValue *
      applyGrowthRate(
        growthRate,
        cashflow.assumptions.terms === 'real' ? cashflow.assumptions.cpi : 0
      )

    outputYear.end_value = round(endValue, 2)
  })
}

export function isAccount(account: BaseAccount): account is Account {
  return account.category === 'cash' || account.category === 'isa'
}

export function isMoneyPurchase(
  account: BaseAccount
): account is MoneyPurchase {
  return account.category === 'money_purchase'
}
