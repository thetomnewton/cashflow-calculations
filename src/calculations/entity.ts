import { date } from '../lib/date'
import { Entity, EntityValue, PlanningYear } from '../types'

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

export function getValueInYear(entity: Entity, year: PlanningYear) {
  const entityValue = entity.values.find(ev => entityValueActive(year, ev))

  if (!entityValue) return 0

  return entityValue.value
}
