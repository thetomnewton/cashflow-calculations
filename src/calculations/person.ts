import dayjs from 'dayjs'
import { Person } from '../types'

export function ageAtDate({ date_of_birth }: Person, date: string) {
  return dayjs.utc(date_of_birth).diff(date, 'year')
}

export function statePensionAge({ date_of_birth }: Person) {
  // todo: update with more accurate state pension logic

  const dob = dayjs.utc(date_of_birth)

  if (dob.isSameOrBefore('1960-04-06')) return 66
  if (dob.isSameOrAfter('1978-04-06')) return 68

  return 67
}
