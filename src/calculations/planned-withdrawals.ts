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
import { getTaxableValue } from './incomes'

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

  // todo: sort accounts into appropriate order

  withdrawables.forEach(account => {
    const withdrawals = account.withdrawals ?? []

    // todo: sort withdrawals into appropriate order

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
  const currentAccountValue = outputYear.current_value ?? 0
  const actualValue = Math.max(0, Math.min(currentAccountValue, intendedValue))

  outputYear.current_value = round(currentAccountValue - actualValue, 2)

  const relatedIncome = cashflow.incomes.find(
    inc => inc.source_id === account.id && !inc.ad_hoc
  )

  if (!relatedIncome) throw new Error('Missing withdrawal income for account')

  const existingValue = relatedIncome.values.find(
    value =>
      value.starts_at === year.starts_at && value.ends_at === year.ends_at
  )

  if (!existingValue)
    relatedIncome.values.push({
      value: actualValue,
      escalation: 0,
      starts_at: year.starts_at,
      ends_at: year.ends_at,
    })
  else existingValue.value += actualValue

  const outputIncomeYear = output.incomes[relatedIncome.id].years[yearIndex]
  outputIncomeYear.gross_value += actualValue
  outputIncomeYear.taxable_value = getTaxableValue(
    relatedIncome,
    outputIncomeYear
  )
}

function withdrawGrossValueFromMoneyPurchase(
  account: MoneyPurchase,
  intendedValue: number,
  method: MoneyPurchaseWithdrawal['method']
) {
  const outputYear = output.money_purchases[account.id].years[yearIndex]

  const keys = [
    'current_value',
    'current_value_uncrystallised',
    'current_value_crystallised',
  ] as const

  keys.forEach(key => {
    const currentValue = outputYear[key] ?? 0
    const actualValue = Math.max(0, Math.min(currentValue, intendedValue))
    outputYear[key] = round(currentValue - actualValue, 2)

    // create an income which may get taxed later
  })
}
