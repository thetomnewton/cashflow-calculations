import { round } from 'lodash'
import {
  Account,
  BaseAccount,
  Cashflow,
  MoneyPurchaseWithdrawal,
  Output,
  OutputMoneyPurchaseYear,
  PlanningYear,
} from '../types'
import {
  areAdHocWithdrawalsTaxable,
  isAccount,
  isMoneyPurchase,
} from './accounts'
import {
  calcIncomeTaxLiability,
  getYearIndex,
  undoIncomeTaxation,
} from './income-tax'
import { setNetValues } from './incomes'
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
  for (const asset of liquidAssets) {
    const netIncomeNeeded = determineWindfallOrShortfall() * -1
    if (netIncomeNeeded === 0) break

    const taxable = areAdHocWithdrawalsTaxable(asset)

    if (!taxable) {
      const accountValue: number =
        output[asset.section][asset.id].years[yearIndex].current_value ?? 0
      const withdrawal = Math.min(netIncomeNeeded, accountValue)
      withdrawGrossValueFromAccount(asset as Account, withdrawal, true)
      undoIncomeTaxation(year, cashflow, output)
      calcIncomeTaxLiability(year, cashflow, output)
      setNetValues(year, cashflow, output)
      continue
    }

    attemptToResolveShortfallFromTaxableSource(asset)
  }

  const netIncomeNeeded = round(determineWindfallOrShortfall() * -1)
  // If there is still a shortfall at this point, take the sweep account into an overdraft

  if (netIncomeNeeded > 0) {
    console.log(`remaining: ${netIncomeNeeded}`)
    const sweep = cashflow.accounts.find(acc => acc.is_sweep)
    if (!sweep) throw new Error('Missing sweep account')
    output.accounts[sweep.id].years[yearIndex].current_value = round(
      (output.accounts[sweep.id].years[yearIndex].current_value ?? 0) -
        netIncomeNeeded,
      2
    )
  }
}

function attemptToResolveShortfallFromTaxableSource(account: BaseAccount) {
  console.log('withdrawing from taxable source')
  const accountValue: number =
    output[account.section][account.id].years[yearIndex].current_value ?? 0
  console.log(`accountValue: ${accountValue}`)

  const netIncomeNeeded = determineWindfallOrShortfall() * -1
  console.log(
    `we need ${netIncomeNeeded} net at the moment, but this may change if e.g. we have dividend incomes`
  )

  // If the account value is less than the net income need, withdraw the whole pot
  if (accountValue <= netIncomeNeeded) {
    console.log(`drawing the entire account value of ${accountValue}`)
    withdrawGrossAmountAndRetaxIncomes(account, accountValue)
    return
  }

  console.log(`we know the account value is more than the net income need`)

  // Withdraw the whole pot. If there is still a shortfall, do that and move on,
  // otherwise, if we withdrew too much then undo what we just did
  withdrawGrossAmountAndRetaxIncomes(account, accountValue)

  let newNetIncomeNeed = determineWindfallOrShortfall() * -1
  if (newNetIncomeNeed >= 0) return

  console.log(`we withdrew too much, undo everything we just did`)
  removeAdHocWithdrawalsFromAccountThisYear(account)
  undoIncomeTaxation(year, cashflow, output)
  calcIncomeTaxLiability(year, cashflow, output)
  setNetValues(year, cashflow, output)
  newNetIncomeNeed = determineWindfallOrShortfall() * -1

  let [min, max] = [newNetIncomeNeed, accountValue]

  console.log(`net income need is now: ${newNetIncomeNeed}`)
  console.log(
    `we know the correct gross withdrawal is somewhere between ${min} and ${max}`
  )

  let attempts = 0
  let amountToTry = min + (max - min) / 2

  while (attempts < 20) {
    console.log(`attempt number ${attempts}`)
    console.log(`attempting ${amountToTry} gross withdrawal`)
    withdrawGrossAmountAndRetaxIncomes(account, amountToTry)
    const windfall = determineWindfallOrShortfall() * -1
    console.log(`windfall: ${windfall}`)
    if (round(windfall) === 0) break

    removeAdHocWithdrawalsFromAccountThisYear(account)
    undoIncomeTaxation(year, cashflow, output)
    calcIncomeTaxLiability(year, cashflow, output)
    setNetValues(year, cashflow, output)

    if (windfall < 0) {
      console.log(`we withdrew too much`)
      max = amountToTry
    } else {
      min = amountToTry
      console.log(`we didn't draw enough`)
    }
    amountToTry = min + (max - min) / 2

    attempts++
  }
}

function withdrawGrossAmountAndRetaxIncomes(
  account: BaseAccount,
  amount: number
) {
  if (isAccount(account)) withdrawGrossValueFromAccount(account, amount, true)
  else if (isMoneyPurchase(account))
    withdrawGrossValueFromMoneyPurchase(account, amount, 'ufpls', true)
  undoIncomeTaxation(year, cashflow, output)
  calcIncomeTaxLiability(year, cashflow, output)
  setNetValues(year, cashflow, output)
}

function removeAdHocWithdrawalsFromAccountThisYear(account: BaseAccount) {
  const tracker: { value: number; method: string | undefined }[] = []

  account.withdrawals = account.withdrawals.filter(w => {
    if (
      w.ad_hoc &&
      w.starts_at === year.starts_at &&
      w.ends_at === year.ends_at
    ) {
      tracker.push({
        value: w.value,
        method: isMoneyPurchase(account)
          ? (w as MoneyPurchaseWithdrawal).method
          : undefined,
      })
      return false
    }
    return true
  })

  cashflow.incomes = cashflow.incomes.filter(inc => {
    if (
      inc.ad_hoc &&
      inc.source_id === account.id &&
      inc.values.length &&
      inc.values[0].starts_at === year.starts_at &&
      inc.values[0].ends_at === year.ends_at
    ) {
      delete output.incomes[inc.id]
      return false
    }
    return true
  })

  tracker.forEach(withdrawal => {
    const outputYear = output[account.section][account.id].years[yearIndex]

    // todo: update the current value of the account to restore the money that was taken
    outputYear.current_value = outputYear.current_value
      ? outputYear.current_value + withdrawal.value
      : withdrawal.value

    if (isMoneyPurchase(account)) {
      const out = outputYear as OutputMoneyPurchaseYear

      if (withdrawal.method === 'ufpls') {
        out.current_value_uncrystallised = out.current_value_uncrystallised
          ? out.current_value_uncrystallised + withdrawal.value
          : withdrawal.value
      } else if (withdrawal.method === 'pcls') {
        out.current_value_uncrystallised = out.current_value_uncrystallised
          ? out.current_value_uncrystallised + withdrawal.value * 4
          : withdrawal.value * 4

        out.current_value_crystallised = out.current_value_crystallised
          ? out.current_value_crystallised + withdrawal.value * -3
          : withdrawal.value * -3
      } else if (withdrawal.method === 'fad') {
        out.current_value_crystallised = out.current_value_crystallised
          ? out.current_value_crystallised + withdrawal.value
          : withdrawal.value
      }
    }
  })
}
