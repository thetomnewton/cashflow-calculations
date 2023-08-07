import { round } from 'lodash'
import { date } from '../lib/date'
import { Cashflow, Entity, EntityValue, Output, PlanningYear } from '../types'

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

  const yearsSinceStart = Math.max(
    0,
    output.years.findIndex(py => py.tax_year === year.tax_year)
  )

  const startingValue = round(
    entityValue.value *
      (1 +
        (entityValue.adjusted ? cashflow.assumptions.cpi : 0) -
        (cashflow.assumptions.terms === 'nominal'
          ? cashflow.assumptions.cpi
          : 0)) **
        yearsSinceStart,
    2
  )

  // todo:
  // get years since entity started
  // get escalated value based on years since it started, and whether real terms or not

  return entityValue.value
}
