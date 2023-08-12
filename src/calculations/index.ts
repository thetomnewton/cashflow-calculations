import { initialise } from './init'
import { Cashflow, Output } from '../types'
import { calcNICs } from './national-insurance'
import { calcIncomeTaxLiability } from './income-tax'

export function run(cashflow: Cashflow): Output {
  const output = initialise(cashflow)

  output.years.forEach(year => {
    // apply contributions
    // apply withdrawals
    calcIncomeTaxLiability(year, cashflow, output)
    calcNICs(year, cashflow, output)
    // apply incomes
    // apply expenses
    // handle income windfall / shortfall
    // apply charges
    // apply growth
    // apply liability interest
  })

  return output
}
