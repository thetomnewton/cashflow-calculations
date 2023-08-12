import { Cashflow, Output, Person, PlanningYear } from '../types'
import {
  incomeClasses,
  taxableIncomeLimits,
  class1Rates,
  class2Tax,
  minAge,
} from '../config/national-insurance'
import dayjs from 'dayjs'
import { getYearIndex } from './income-tax'
import { inRange } from 'lodash'

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
  const age = personAgeAtDate(
    person,
    output.years[getYearIndex(taxYear, output)].starts_at
  )

  // todo: Eligible to pay NICs if between 16 and state pension age

  return inRange(age, minAge, personStatePensionAge(person))
}

function personAgeAtDate(person: Person, date: string) {
  return dayjs.utc(person.date_of_birth).diff(date, 'year')
}

function personStatePensionAge(person: Person) {
  // todo: Replace with real state pension calculation
  return 67
}
