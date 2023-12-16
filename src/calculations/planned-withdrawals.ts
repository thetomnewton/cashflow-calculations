import { round } from 'lodash'
import {
  Account,
  Cashflow,
  MoneyPurchase,
  MoneyPurchaseWithdrawal,
  Output,
  PlanningYear,
} from '../types'
import { isAccount, isMoneyPurchase } from './accounts'
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

  const withdrawables = [...cashflow.accounts, ...cashflow.money_purchases]

  // todo: sort into appropriate order

  withdrawables.forEach(account => {
    const withdrawals = account.withdrawals ?? []

    withdrawals.forEach(withdrawal => {
      if (!entityValueActive(year, withdrawal)) return

      const grossValue = getValueInYear(withdrawal, year, cashflow, output)

      if (grossValue <= 0) return

      if (isAccount(account)) {
        withdrawGrossValueFromAccount(account, grossValue)
      } else if (isMoneyPurchase(account)) {
        withdrawGrossValueFromMoneyPurchase(
          account,
          grossValue,
          (withdrawal as MoneyPurchaseWithdrawal).method
        )
      }
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

function withdrawGrossValueFromMoneyPurchase(
  account: MoneyPurchase,
  intendedValue: number,
  method: MoneyPurchaseWithdrawal['method']
) {
  const outputYear = output.money_purchases[account.id].years[yearIndex]

  let keys = [
    'current_value',
    'current_value_uncrystallised',
    'current_value_crystallised',
  ] as const

  keys.forEach(key => {
    const currentValue = outputYear[key] ?? 0
    const actualValue = Math.max(0, Math.min(currentValue, intendedValue))
    outputYear[key] = round(currentValue - actualValue, 2)
  })
}
