import { round } from 'lodash'
import { Account, Cashflow, Output, PlanningYear } from '../types'
import { entityValueActive, getValueInYear } from './entity'
import { getYearIndex } from './income-tax'

let cashflow: Cashflow
let output: Output
let year: PlanningYear
let yearIndex: number

export function applyPlannedWithdrawals(
  baseYear: PlanningYear,
  baseCashflow: Cashflow,
  baseOutput: Output
) {
  year = baseYear
  cashflow = baseCashflow
  output = baseOutput
  yearIndex = getYearIndex(year.tax_year, output)

  cashflow.accounts.forEach(account => {
    const withdrawals = account.withdrawals ?? []

    withdrawals.forEach(withdrawal => {
      if (!entityValueActive(year, withdrawal)) return

      const grossValue = getValueInYear(withdrawal, year, cashflow, output)

      if (grossValue > 0) withdrawGrossValueFromAccount(account, grossValue)
    })
  })
}

function withdrawGrossValueFromAccount(
  account: Account,
  intendedValue: number
) {
  const outputYear = output.accounts[account.id].years[yearIndex]

  const currentValue = outputYear.current_value ?? 0

  const actualValue = Math.max(0, Math.min(currentValue, intendedValue))

  outputYear.current_value = round(currentValue - actualValue, 2)

  // todo: log the actual withdrawal
}
