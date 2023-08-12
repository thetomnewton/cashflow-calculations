import { Cashflow, Output, PlanningYear } from '../types'
import {
  incomeClasses,
  taxableIncomeLimits,
  class1Rates,
  class2Tax,
} from '../config/national-insurance'

let taxYear: string

export function calcNICs(
  year: PlanningYear,
  cashflow: Cashflow,
  output: Output
) {
  taxYear = year.tax_year

  // eligible to pay NICs if between 16 and state pension age
  // include bonuses if employment income
}
