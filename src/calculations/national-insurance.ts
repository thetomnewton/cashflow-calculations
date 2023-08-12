import { Cashflow, Output, Person, PlanningYear } from '../types'
import {
  incomeClasses,
  taxableIncomeLimits,
  class1Rates,
  class2Tax,
  minAge,
} from '../config/national-insurance'
import { getYearIndex } from './income-tax'
import { inRange } from 'lodash'
import { ageAtDate, statePensionAge } from './person'

let taxYear: string
let cashflow: Cashflow
let output: Output

export function calcNICs(
  year: PlanningYear,
  baseCashflow: Cashflow,
  baseOutput: Output
) {
  taxYear = year.tax_year
  cashflow = baseCashflow
  output = baseOutput

  cashflow.incomes
    .filter(({ type }) => Object.keys(incomeClasses).includes(type))
    .filter(({ people }) => people.every(shouldPayNICsThisYear))
    .forEach(income => {
      // include bonuses if employment income
      //
    })
}

function shouldPayNICsThisYear(person: Person) {
  const age = ageAtDate(
    person,
    output.years[getYearIndex(taxYear, output)].starts_at
  )

  return inRange(age, minAge, statePensionAge(person))
}
