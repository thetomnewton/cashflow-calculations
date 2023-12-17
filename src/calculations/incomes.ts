import { round, sum, sumBy } from 'lodash'
import {
  Cashflow,
  EmploymentIncome,
  Income,
  OtherTaxableIncome,
  Output,
  OutputIncomeYear,
  PlanningYear,
  SelfEmploymentIncome,
} from '../types'
import { getYearIndex } from './income-tax'

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

export function isOtherTaxableIncome(
  income: Income
): income is OtherTaxableIncome {
  return income.type === 'other_taxable'
}

export function getTaxableValue(income: Income, value: OutputIncomeYear) {
  if (!incomeIsTaxable(income)) return 0

  const baseFn = (value: OutputIncomeYear) => value.gross_value

  return {
    employment: (value: OutputIncomeYear) =>
      value.gross_value + (value.bonus ?? 0) + (value.benefits ?? 0),
    self_employment: baseFn,
    dividend: baseFn,
    pension: (value: OutputIncomeYear) => {
      return value.gross_value
    },
    savings: baseFn,
    other_taxable: baseFn,
    other_non_taxable: () => 0,
  }[income.type](value)
}

function incomeIsTaxable(income: Income) {
  // todo: "pension" income may be taxable depending on the withdrawal type
  return income.type !== 'other_non_taxable'
}
