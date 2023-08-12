import { Cashflow, Output, Person, PlanningYear } from '../types'
import {
  incomeClasses,
  taxableIncomeLimits,
  class1Rates,
  class2Tax,
} from '../config/national-insurance'

let taxYear: string
let cashflow: Cashflow

export function calcNICs(
  year: PlanningYear,
  baseCashflow: Cashflow,
  output: Output
) {
  taxYear = year.tax_year
  cashflow = baseCashflow

  cashflow.incomes
    .filter(({ type }) => Object.keys(incomeClasses).includes(type))
    .filter(({ people }) => people.every(shouldPayNICsThisYear))
    .forEach(income => {
      // include bonuses if employment income
      //
    })
}

function shouldPayNICsThisYear(person: Person) {
  // eligible to pay NICs if between 16 and state pension age
  return true
}
