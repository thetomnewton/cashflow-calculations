import { Cashflow, Output } from '../types'
import { initialise } from './init'
import { calculateIncomeTaxLiability } from './income-tax'

export function run(cashflow: Cashflow): Output {
  const output = initialise(cashflow)

  output.years.forEach(year => {
    // apply contributions
    // apply planned withdrawals
    // calculate income tax
    calculateIncomeTaxLiability(year, cashflow, output)
    // calculate NICs
    // apply incomes
    // apply expenses
    // handle income windfall / shortfall
    // apply charges
    // apply growth
    // apply liability interest
  })

  return output
}
