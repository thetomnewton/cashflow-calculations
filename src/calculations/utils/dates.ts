import { Dayjs } from 'dayjs';
import { date } from '../../lib/date';
import { Output, PlanningYear } from '../../types';

export function getTaxYearFromDate(initialDate: Dayjs | string) {
  const dateObj =
    typeof initialDate === 'string' ? date(initialDate) : initialDate;

  const year = dateObj.year();
  const yearString = year.toString().substring(2);

  if (dateObj.month() > 3 || (dateObj.month() === 3 && dateObj.date() >= 6))
    return `${yearString}${(year + 1).toString().substring(2)}`;
  else return `${(year - 1).toString().substring(2)}${yearString}`;
}

export function getYearIndex(year: PlanningYear['tax_year'], output: Output) {
  return output.years.findIndex(({ tax_year }) => tax_year === year);
}
