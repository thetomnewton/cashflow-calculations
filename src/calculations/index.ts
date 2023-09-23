import { initialise } from './init'
import { Cashflow, Output, PlanningYear } from '../types'
import { calcNICs } from './national-insurance'
import { calcIncomeTaxLiability } from './income-tax'
import { setNetValues } from './incomes'
import { applyGrowth, initialiseAccounts } from './accounts'
import { applyContributions } from './contributions'

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
  // apply withdrawals
  calcIncomeTaxLiability(year, cashflow, output)
  calcNICs(year, cashflow, output)
  setNetValues(year, cashflow, output)
  // apply incomes
  // apply expenses
  // handle income windfall / shortfall
  // apply charges
  // apply growth
  applyGrowth(cashflow, output)
  // apply liability interest
}
