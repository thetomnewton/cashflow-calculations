import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

export function date(params?: string | number | Date | dayjs.Dayjs) {
  return dayjs(params)
}
