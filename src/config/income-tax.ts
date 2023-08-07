import { Dayjs } from 'dayjs'

const known = {
  2324: [
    {
      type: 'allowance',
      sub_type: 'personal_allowance',
      bound_lower: 0,
      bound_upper: 12570,
      taper_rate: 0.5,
      adjusted_net_income_limit: 100000,
      regions: {
        earned: ['wal', 'eng', 'sco', 'ni'],
        savings: ['wal', 'eng', 'sco', 'ni'],
        dividend: ['wal', 'eng', 'sco', 'ni'],
      },
    },

    {
      type: 'income_tax_band',
      sub_type: 'basic_rate',
      bound_lower: 0,
      bound_upper: 37700,
      regions: {
        earned: ['wal', 'eng', 'ni'],
        savings: ['wal', 'eng', 'sco', 'ni'],
        dividend: ['wal', 'eng', 'sco', 'ni'],
      },
    },
  ],
}

export function getTaxYearFromDate(date: Dayjs) {
  const year = date.year()
  if (date.month() > 3 || (date.month() === 3 && date.date() >= 6)) {
    return `${year.toString().substring(2)}${(year - 1)
      .toString()
      .substring(2)}`
  } else {
    return `${(year - 1).toString().substring(2)}${year
      .toString()
      .substring(2)}`
  }
}
