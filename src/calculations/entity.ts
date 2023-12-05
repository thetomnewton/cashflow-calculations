import { round } from 'lodash'
import { date } from '../lib/date'
import { Cashflow, Entity, EntityValue, Output, PlanningYear } from '../types'
import { applyGrowth } from './growth'
import { getTaxYearFromDate } from './income-tax'

function entityValueActive(year: PlanningYear, ev: EntityValue) {
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

export function getValueInYear(
  entity: Entity,
  year: PlanningYear,
  cashflow: Cashflow,
  output: Output
) {
  const entityValue = entity.values.find(ev => entityValueActive(year, ev))

  if (!entityValue) return 0

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
    entityValue.value *
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

  const out = round(
    startingValue *
      applyGrowth(
        escalationRate,
        cashflow.assumptions.terms === 'real' ? cashflow.assumptions.cpi : 0
      ) **
        yearsSinceEntityStart,
    2
  )

  return out
}
