import {
  Cashflow,
  Income,
  Output,
  OutputIncomeYear,
  Person,
  PlanningYear,
  PossibleNICs,
} from '../types'
import {
  incomeClasses,
  taxableIncomeLimits,
  class1Rates,
  class2Tax,
  class4Rates,
  minAge,
} from '../config/national-insurance'
import { getYearIndex } from './income-tax'
import { inRange, round } from 'lodash'
import { ageAtDate, statePensionAge } from './person'

let taxYear: string
let cashflow: Cashflow
let output: Output

type LimitsType = typeof taxableIncomeLimits

export function calcNICs(
  year: PlanningYear,
  baseCashflow: Cashflow,
  baseOutput: Output
) {
  taxYear = year.tax_year
  cashflow = baseCashflow
  output = baseOutput

  cashflow.incomes
    .filter(incomeRelevantToNICs)
    .filter(({ people }) => people.every(shouldPayNICsThisYear))
    .forEach(income => {
      const outputYear =
        output.incomes[income.id].years[getYearIndex(year.tax_year, output)]

      const total = totalIncomeSubjectToNICs(income, outputYear)

      payNationalInsuranceOn(total / income.people.length, income, outputYear)
    })
}

const incomeRelevantToNICs = ({ type }: Income) =>
  Object.keys(incomeClasses).includes(type)

function shouldPayNICsThisYear(person: Person) {
  const age = ageAtDate(
    person,
    output.years[getYearIndex(taxYear, output)].starts_at
  )

  return inRange(age, minAge, statePensionAge(person))
}

function totalIncomeSubjectToNICs(
  { type }: Income,
  outputYear: OutputIncomeYear
) {
  if (type === 'employment')
    return outputYear.gross_value + (outputYear.bonus ?? 0)
  return outputYear.gross_value
}

function getProjectedLimits(
  terms: Cashflow['assumptions']['terms'],
  cpi: Cashflow['assumptions']['cpi']
) {
  return Object.fromEntries(
    Object.entries(taxableIncomeLimits).map(([key, value]) => {
      if (terms === 'real') return [key, value]

      const inflatedValue = value * (1 + cpi) ** getYearIndex(taxYear, output)
      return [key, round(inflatedValue, 2)]
    })
  ) as LimitsType
}

function payNationalInsuranceOn(
  total: number,
  income: Income,
  outputYear: OutputIncomeYear
) {
  const NIClasses =
    incomeClasses[income.type as 'employment' | 'self_employment']

  const projectedLimits = getProjectedLimits(
    cashflow.assumptions.terms,
    cashflow.assumptions.cpi
  )

  NIClasses.forEach(className => {
    outputYear.tax.ni_paid[className] = {
      class1: () => runClass1Calculation(total, projectedLimits),
      class2: () => runClass2Calculation(total),
      class4: () => runClass4Calculation(total, projectedLimits),
    }[className as PossibleNICs]()
  })
}

function runClass1Calculation(total: number, limits: LimitsType) {
  let out = 0
  out += Math.min(total, limits.lower_profits_limit) * class1Rates.below_lpl

  out +=
    Math.max(
      0,
      Math.min(total, limits.upper_profits_limit) - limits.lower_profits_limit
    ) * class1Rates.below_upl

  out += Math.max(0, total - limits.upper_profits_limit) * class1Rates.above_upl

  return round(out, 2)
}

function runClass2Calculation(total: number) {
  return total >= taxableIncomeLimits.lower_profits_limit
    ? round(class2Tax.above_lpl, 2)
    : 0
}

function runClass4Calculation(total: number, limits: LimitsType) {
  let out = 0
  out += Math.min(total, limits.lower_profits_limit) * class4Rates.below_lpl

  out +=
    Math.max(
      0,
      Math.min(total, limits.upper_profits_limit) - limits.lower_profits_limit
    ) * class4Rates.below_upl

  out += Math.max(0, total - limits.upper_profits_limit) * class4Rates.above_upl

  return round(out, 2)
}
