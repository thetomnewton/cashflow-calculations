import { round } from 'lodash'
import { date } from '../lib/date'
import { Cashflow, Entity, EntityValue, Output, PlanningYear } from '../types'
import { applyGrowth } from './growth'
import { getTaxYearFromDate } from './income-tax'

export function entityValueActive(year: PlanningYear, ev: EntityValue) {
  const yearStart = date(year.starts_at)
  const yearEnd = date(year.ends_at)
  const entityStart = date(ev.starts_at)
  const entityEnd = date(ev.ends_at)

  if (entityStart.isBetween(yearStart, yearEnd, null, '[)')) return true

  if (entityStart.isSameOrBefore(yearStart) && entityEnd.isSameOrAfter(yearEnd))
    return true

  if (entityStart.isSameOrBefore(yearStart) && entityEnd.isAfter(yearStart))
    return true

  return false
}

export function findActiveEntityValue(entity: Entity, year: PlanningYear) {
  return entity.values.find(ev => entityValueActive(year, ev))
}

export function getValueInYear(
  entityValue: EntityValue,
  year: PlanningYear,
  cashflow: Cashflow,
  output: Output,
  key: 'value' | 'bonus' | 'benefits' = 'value'
) {
  if (!entityValue || typeof entityValue[key] === 'undefined') return 0

  const num = entityValue[key] as number

  const yearsSinceCashflowStart = Math.max(
    0,
    output.years.findIndex(py => py.tax_year === year.tax_year)
  )

  const startDateTaxYear = +getTaxYearFromDate(
    date(entityValue.starts_at)
  ).substring(0, 2)

  const thisTaxYear = +year.tax_year.substring(0, 2)

  const yearsSinceEntityStart = thisTaxYear - startDateTaxYear

  const startingValue = round(
    num *
      applyGrowth(
        entityValue.adjusted ? cashflow.assumptions.cpi : 0,
        cashflow.assumptions.terms === 'real' ? cashflow.assumptions.cpi : 0
      ) **
        (yearsSinceCashflowStart - yearsSinceEntityStart),
    2
  )

  const escalationRate =
    typeof entityValue.escalation === 'string'
      ? cashflow.assumptions[entityValue.escalation]
      : entityValue.escalation

  const inflation =
    cashflow.assumptions.terms === 'real' ? cashflow.assumptions.cpi : 0

  return runValueProjection({
    startingValue,
    escalationRate,
    inflation,
    yearsSinceEntityStart,
  })
}

type RunValueProjectionProps = {
  startingValue: number
  escalationRate: number
  inflation: number
  yearsSinceEntityStart: number
}

function runValueProjection({
  startingValue,
  escalationRate,
  inflation,
  yearsSinceEntityStart,
}: RunValueProjectionProps) {
  return round(
    startingValue *
      applyGrowth(escalationRate, inflation) ** yearsSinceEntityStart,
    2
  )
}
