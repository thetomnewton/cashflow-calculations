import { round } from 'lodash'
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

  const windfallOrShortfall = determineWindfallOrShortfall()

  if (windfallOrShortfall === 0) return

  if (windfallOrShortfall > 0) handleWindfall(round(windfallOrShortfall, 2))
  else handleShortfall()
}

function determineWindfallOrShortfall() {
  const totalIncome = cashflow.incomes.reduce((total, income) => {
    return total + output.incomes[income.id].years[yearIndex].net_value
  }, 0)

  const totalExpenses = cashflow.expenses.reduce((total, expense) => {
    return total + output.expenses[expense.id].years[yearIndex].value
  }, 0)

  return totalIncome - totalExpenses
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
function handleShortfall() {
  // Get the liquid assets and sort them into the correct order
  const liquidAssets = getAvailableLiquidAssets()
  sortAssetsIntoLiquidationOrder(liquidAssets)

  // Make some ad-hoc withdrawals.
  // If we just made any ad-hoc withdrawals, especially if
  // the withdrawals were taxable, we need to re-tax
  // everything and see if the shortfall was met.
  drawFromLiquidAssets(liquidAssets)

  if (round(determineWindfallOrShortfall(), 2) !== 0)
    throw new Error('Failed to meet shortfall')
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

function drawFromLiquidAssets(liquidAssets: BaseAccount[]) {
  /**
   * recalculate income tax:
  undoIncomeTaxation(year, cashflow, output)
  calcIncomeTaxLiability(year, cashflow, output)
  setNetValues(year, cashflow, output)
   */

  let netIncomeNeeded = determineWindfallOrShortfall() * -1
  console.log(`netIncomeNeeded: ${netIncomeNeeded}`)

  for (const asset of liquidAssets) {
    if (netIncomeNeeded === 0) break

    let remainingAccountValue: number =
      output[asset.section][asset.id].years[yearIndex].current_value ?? 0

    // Make an ad-hoc withdrawal. First, see what can be withdrawn gross from this asset.
    const withdrawal = Math.min(netIncomeNeeded, remainingAccountValue)

    if (isAccount(asset)) {
      const { actualWithdrawal } = withdrawGrossValueFromAccount(
        asset,
        withdrawal,
        true
      )

      netIncomeNeeded -= actualWithdrawal
    } else if (isMoneyPurchase(asset)) {
      const { actualWithdrawal } = withdrawGrossValueFromMoneyPurchase(
        asset,
        withdrawal,
        'ufpls', // todo: might want to take some as UFPLS and some as FAD
        true
      )

      netIncomeNeeded -= actualWithdrawal
    }
  }

  // If there is still a shortfall at this point, take the sweep account into an overdraft
  if (netIncomeNeeded > 0) {
    const sweep = cashflow.accounts.find(acc => acc.is_sweep)
    if (!sweep) throw new Error('Missing sweep account')

    output.accounts[sweep.id].years[yearIndex].current_value = round(
      (output.accounts[sweep.id].years[yearIndex].current_value ?? 0) -
        netIncomeNeeded,
      2
    )

    netIncomeNeeded = 0
  }
}

function removeAllAdHocWithdrawals() {
  // Remove all ad-hoc withdrawals
  const sections = ['accounts', 'money_purchases'] as const
  sections.forEach(section => {
    cashflow[section].forEach(asset => {
      asset.withdrawals = asset.withdrawals.filter(w => !w.ad_hoc)
    })
  })

  // Undo all ad-hoc withdrawals drawing from the liquid assets
  cashflow.incomes = cashflow.incomes.filter(inc => {
    if (inc.ad_hoc) {
      delete output.incomes[inc.id]
      return false
    }
    return true
  })
}
