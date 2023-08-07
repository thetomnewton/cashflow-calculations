import { Dayjs } from 'dayjs'
import { Band, Person, PlanningYear } from '../types'

const bands: Band[] = [
  {
    key: 'personal_allowance',
    type: 'allowance',
    taper_rate: 0.5,
    adjusted_net_income_limit: 100000,
    regions: {
      earned: ['wal', 'eng', 'sco', 'ni'],
      savings: ['wal', 'eng', 'sco', 'ni'],
      dividend: ['wal', 'eng', 'sco', 'ni'],
    },
  },
  {
    key: 'basic_rate_eng',
    type: 'band',
    regions: {
      earned: ['wal', 'eng', 'ni'],
      savings: ['wal', 'eng', 'sco', 'ni'],
      dividend: ['wal', 'eng', 'sco', 'ni'],
    },
  },
]

type KnownRatesType = {
  [key: PlanningYear['tax_year']]: {
    key: Band['key']
    bound_lower: number
    bound_upper: number
  }[]
}

const knownRates: KnownRatesType = {
  2324: [
    {
      key: 'personal_allowance',
      bound_lower: 0,
      bound_upper: 12570,
    },
    {
      key: 'basic_rate_eng',
      bound_lower: 0,
      bound_upper: 37700,
    },
  ],
}

export function getTaxYearFromDate(date: Dayjs) {
  const year = date.year()
  if (date.month() > 3 || (date.month() === 3 && date.date() >= 6)) {
    return `${year.toString().substring(2)}${(year + 1)
      .toString()
      .substring(2)}`
  } else {
    return `${(year - 1).toString().substring(2)}${year
      .toString()
      .substring(2)}`
  }
}

function bandIsRelevantTo(person: Person, band: Band) {
  return (
    band.regions.earned.includes(person.tax_residency) ||
    band.regions.savings.includes(person.tax_residency) ||
    band.regions.dividend.includes(person.tax_residency)
  )
}

function getRatesForBandInYear(
  key: Band['key'],
  year: PlanningYear['tax_year']
) {
  if (knownRates[year]) {
    const knownRate = knownRates[year].find(rate => rate.key === key)
    if (knownRate) return knownRate
    throw new Error(`Missing band rate (${key}) in year ${year}`)
  }

  return {
    key,
    bound_lower: 123,
    bound_upper: 456,
  }
}

export function generateBandsFor(
  person: Person,
  year: PlanningYear['tax_year']
) {
  return bands
    .filter(band => bandIsRelevantTo(person, band))
    .map(band => getRatesForBandInYear(band.key, year))
}
