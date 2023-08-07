import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import isBetween from 'dayjs/plugin/isBetween'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'

dayjs.extend(utc)
dayjs.extend(isBetween)
dayjs.extend(isSameOrBefore)
dayjs.extend(isSameOrAfter)

export function date(params?: string | number | Date | dayjs.Dayjs) {
  return dayjs.utc(params)
}

export function iso(params?: string | number | Date | dayjs.Dayjs) {
  return date(params).toISOString()
}
