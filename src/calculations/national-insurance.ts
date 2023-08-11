import { Cashflow, Output, PlanningYear } from '../types'

let taxYear: string

export function calcNICs(
  year: PlanningYear,
  cashflow: Cashflow,
  output: Output
) {
  taxYear = year.tax_year

  // eligible to pay NICs if between 16 and state pension age
  //
}
