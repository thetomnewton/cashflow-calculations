import { date } from '../lib/date'
import { Entity, PlanningYear } from '../types'

export function getValueInYear(entity: Entity, year: PlanningYear) {
  const yearStart = date(year.starts_at)
  const yearEnd = date(year.ends_at)

  const valueObj = entity.values.find(entityValue => {
    const entityStart = date(entityValue.starts_at)
    const entityEnd = date(entityValue.ends_at)

    if (entityStart.isBetween(yearStart, yearEnd, null, '[)')) return true

    if (
      entityStart.isSameOrBefore(yearStart) &&
      entityEnd.isSameOrAfter(yearEnd)
    )
      return true

    if (entityStart.isSameOrBefore(yearStart) && entityEnd.isAfter(yearStart))
      return true

    return false
  })

  if (!valueObj) return 0

  return valueObj.value
}
