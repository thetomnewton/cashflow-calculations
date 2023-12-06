import { Cashflow, Output, PlanningYear } from '../types'
import { applyGrowth, initialiseAccounts } from './accounts'
import { applyContributions } from './contributions'
import { calcIncomeTaxLiability } from './income-tax'
import { setNetValues } from './incomes'
import { initialise } from './init'
import { calcNICs } from './national-insurance'

let output: Output
let cashflow: Cashflow

export function run(base: Cashflow): Output {
  cashflow = base

  output = initialise(cashflow)
  output.years.forEach(runYearCalculation)

  return output
}

function runYearCalculation(year: PlanningYear) {
  initialiseAccounts(year, cashflow, output)
  applyContributions(year, cashflow, output)
  // todo: apply planned withdrawals
  calcIncomeTaxLiability(year, cashflow, output)
  calcNICs(year, cashflow, output)
  setNetValues(year, cashflow, output)
  // apply incomes to sweep acct
  // apply expenses to accounts
  // handle income windfall / shortfall
  // apply charges
  applyGrowth(cashflow, output)
  // apply liability interest
}
