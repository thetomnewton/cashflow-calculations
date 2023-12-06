import { round, sum, sumBy } from 'lodash'
import {
  Cashflow,
  EmploymentIncome,
  Income,
  OtherIncome,
  Output,
  PlanningYear,
  SelfEmploymentIncome,
} from '../types'
import { getYearIndex, incomeIsTaxable } from './income-tax'

export function setNetValues(
  year: PlanningYear,
  cashflow: Cashflow,
  output: Output
) {
  cashflow.incomes.forEach(income => {
    const out =
      output.incomes[income.id].years[getYearIndex(year.tax_year, output)]

    if (!incomeIsTaxable(income)) {
      out.net_value = out.gross_value
      return
    }

    out.net_value = out.gross_value

    if (isEmployment(income))
      out.net_value += (out.bonus ?? 0) + (out.benefits ?? 0)

    out.net_value -= sum(Object.values(out.tax.ni_paid))
    out.net_value -= sumBy(Object.values(out.tax.bands), 'tax_paid')

    out.net_value = round(out.net_value, 2)
  })
}

export function isEmployment(income: Income): income is EmploymentIncome {
  return income.type === 'employment'
}

export function isSelfEmployment(
  income: Income
): income is SelfEmploymentIncome {
  return income.type === 'self_employment'
}

export function isOtherIncome(income: Income): income is OtherIncome {
  return income.type === 'other'
}
