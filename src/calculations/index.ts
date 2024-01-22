import { Cashflow, CashflowSchema, Output, PlanningYear } from '../types'
import {
  applyGrowth,
  initialiseAccounts,
  initialiseMoneyPurchases,
} from './accounts'
import { applyContributions } from './contributions'
import { applyExpenses } from './expenses'
import { calcIncomeTaxLiability } from './income-tax'
import { setNetValues } from './incomes'
import { initialise } from './init'
import { calcNICs } from './national-insurance'
import { applyPlannedWithdrawals } from './planned-withdrawals'

let output: Output
let cashflow: Cashflow

export function run(base: Cashflow): Output {
  CashflowSchema.parse(base)
  cashflow = base
  output = initialise(cashflow)
  output.years.forEach(runYearCalculation)

  return output
}

function runYearCalculation(year: PlanningYear) {
  initialiseAccounts(year, cashflow, output)
  initialiseMoneyPurchases(year, cashflow, output)
  applyContributions(year, cashflow, output)
  applyPlannedWithdrawals(year, cashflow, output)
  calcIncomeTaxLiability(year, cashflow, output)
  calcNICs(year, cashflow, output)
  setNetValues(year, cashflow, output)
  applyExpenses(year, cashflow, output)
  applyGrowth(cashflow, output)
}
