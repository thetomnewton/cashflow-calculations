import { BaseAccount, Cashflow, Output, PlanningYear } from '../types'
import { isAccount, isMoneyPurchase } from './accounts'
import { getYearIndex } from './income-tax'
import {
  withdrawGrossValueFromAccount,
  withdrawGrossValueFromMoneyPurchase,
} from './planned-withdrawals'

let year: PlanningYear
let yearIndex: number
let cashflow: Cashflow
let output: Output

export function applyExpenses(
  baseYear: PlanningYear,
  baseCashflow: Cashflow,
  baseOutput: Output
) {
  year = baseYear
  cashflow = baseCashflow
  output = baseOutput
  yearIndex = getYearIndex(year.tax_year, output)

  const totalIncome = cashflow.incomes.reduce((total, income) => {
    return total + output.incomes[income.id].years[yearIndex].net_value
  }, 0)

  const totalExpenses = cashflow.expenses.reduce((total, expense) => {
    return total + output.expenses[expense.id].years[yearIndex].value
  }, 0)

  if (totalIncome === totalExpenses) return

  if (totalIncome >= totalExpenses) {
    handleWindfall(totalIncome - totalExpenses)
    return
  }

  handleShortfall((totalIncome - totalExpenses) * -1)
}

function handleWindfall(initialWindfall: number) {
  if (initialWindfall < 0) throw new Error('Negative windfall')
  let remainingWindfall = initialWindfall

  // If the sweep account is below zero, firstly attempt to get that back to
  // zero with some, or all, of the windfall.
  const sweep = cashflow.accounts.find(acc => acc.is_sweep)
  if (!sweep) throw new Error('Missing sweep account')

  const currentSweepValue =
    output.accounts[sweep.id].years[yearIndex].current_value ?? 0

  // Bring the sweep account value back from below 0, if we can
  if (currentSweepValue < 0) {
    const amountToSave = Math.min(remainingWindfall, currentSweepValue * -1)

    output.accounts[sweep.id].years[yearIndex].current_value =
      (output.accounts[sweep.id].years[yearIndex].current_value ?? 0) +
      amountToSave

    remainingWindfall -= amountToSave
  }

  // Move the remaining windfall based on the settings
  if (cashflow.assumptions.windfall_save === 'sweep') {
    output.accounts[sweep.id].years[yearIndex].current_value =
      (output.accounts[sweep.id].years[yearIndex].current_value ?? 0) +
      remainingWindfall
  } else if (cashflow.assumptions.windfall_save === 'discard') {
    // todo: discard any surplus income which didn't come from one-off income
  }
}

// Liquidate some accounts in order to cover the deficit.
function handleShortfall(initialShortfall: number) {
  if (initialShortfall < 0) throw new Error('Negative shortfall')

  let remainingShortfall = initialShortfall

  // Get the liquid assets and sort them into the correct order
  const liquidAssets = getAvailableLiquidAssets()
  sortAssetsIntoLiquidationOrder(liquidAssets)

  const tracker = drawFromLiquidAssets(liquidAssets, remainingShortfall)

  // if we just took tax-free withdrawals from this asset, no problem,
  // however if withdrawals are taxable then we need to figure out
  // the correct gross amount that would meet the shortfall after tax.
}

function getAvailableLiquidAssets() {
  return [
    ...cashflow.accounts.filter(acc => {
      // todo: add more logic around if this can be liquidated or not
      if (acc.is_sweep) return false
      return (output.accounts[acc.id].years[yearIndex].current_value ?? 0) > 0
    }),
    ...cashflow.money_purchases.filter(pension => {
      // todo: add more logic around if this can be liquidated or not,
      // e.g. if the pension access age is met yet
      return (
        (output.money_purchases[pension.id].years[yearIndex].current_value ??
          0) > 0
      )
    }),
  ]
}

function sortAssetsIntoLiquidationOrder(accounts: BaseAccount[]) {
  accounts.sort((a, b) => {
    return 0 // todo: implement sorting
  })
}

function drawFromLiquidAssets(
  liquidAssets: BaseAccount[],
  remainingShortfall: number
) {
  const tracker = []

  // Go through each asset. Each time we take money out, we need to re-tax
  // our incomes to see if our total income for the year is enough to meet
  // our total expenses. Repeat until the deficit is met.
  for (const asset of liquidAssets) {
    if (remainingShortfall === 0) break

    let remainingAccountValue: number =
      output[asset.section][asset.id].years[yearIndex].current_value ?? 0

    // Make an ad-hoc withdrawal. First, see what can be withdrawn gross from this asset.

    if (isAccount(asset)) {
      const withdrawal = Math.min(remainingShortfall, remainingAccountValue)

      const { actualValue } = withdrawGrossValueFromAccount(
        asset,
        withdrawal,
        true
      )

      remainingShortfall -= actualValue
      tracker.push({ id: asset.id, amount: actualValue })
    } else if (isMoneyPurchase(asset)) {
      // todo: we might want to draw some from uncrystallised/crystallised
      // portions as FAD or UFPLS, or both.
      const withdrawal = Math.min(remainingShortfall, remainingAccountValue)

      const { actualWithdrawal } = withdrawGrossValueFromMoneyPurchase(
        asset,
        withdrawal,
        'ufpls',
        true
      )

      remainingShortfall -= actualWithdrawal
      tracker.push({ id: asset.id, amount: actualWithdrawal })
    }

    return tracker
  }
}
