import { Account, Cashflow, Output, PlanningYear } from '../types'
import { getValueInYear } from './entity'
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
      const grossValue = getValueInYear(withdrawal, year, cashflow, output)

      withdrawGrossValueFromAccount(account, grossValue)
    })
  })
}

function withdrawGrossValueFromAccount(account: Account, grossValue: number) {
  const outputYear = output.accounts[account.id].years[yearIndex]

  let actualWithdrawal: number
  const currentValue = outputYear.current_value ?? 0

  actualWithdrawal = Math.max(
    0,
    Math.min(currentValue - grossValue, grossValue)
  )

  outputYear.current_value = currentValue - actualWithdrawal

  // todo: log the actual withdrawal somewhere
}
