import { date } from '../lib/date'
import { Entity, PlanningYear } from '../types'

export function getValueInYear(entity: Entity, year: PlanningYear) {
  const yearStart = date(year.starts_at)
  const yearEnd = date(year.ends_at)

  const valueObj = entity.values.find(entityValue => {
    if (date(entityValue.starts_at).isBetween(yearStart, yearEnd, null, '[)'))
      return true

    if (
      date(entityValue.starts_at).isSameOrBefore(yearStart) &&
      date(entityValue.ends_at).isSameOrAfter(yearEnd)
    )
      return true

    if (
      date(entityValue.starts_at).isSameOrBefore(yearStart) &&
      date(entityValue.ends_at).isAfter(yearStart)
    )
      return true

    return false
  })

  if (!valueObj) return 0

  return valueObj.value
}
