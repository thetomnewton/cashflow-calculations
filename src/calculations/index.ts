import { initialise } from './init'
import { Cashflow, Output } from '../types'
import { calcNICs } from './national-insurance'
import { calcIncomeTaxLiability } from './income-tax'
import { setNetValues } from './incomes'
import { initialiseAccounts } from './accounts'

export function run(cashflow: Cashflow): Output {
  const output = initialise(cashflow)

  output.years.forEach(year => {
    initialiseAccounts(year, cashflow, output)
    // apply contributions
    // apply withdrawals
    calcIncomeTaxLiability(year, cashflow, output)
    calcNICs(year, cashflow, output)
    setNetValues(year, cashflow, output)
    // apply incomes
    // apply expenses
    // handle income windfall / shortfall
    // apply charges
    // apply growth
    // apply liability interest
  })

  return output
}
