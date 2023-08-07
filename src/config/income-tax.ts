import { Dayjs } from 'dayjs'
import {
  Band,
  CashflowAssumptions,
  Output,
  OutputTaxBand,
  Person,
  PlanningYear,
} from '../types'

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
    extends_for_ras_contributions: true,
    regions: {
      earned: ['wal', 'eng', 'ni'],
      savings: ['wal', 'eng', 'sco', 'ni'],
      dividend: ['wal', 'eng', 'sco', 'ni'],
    },
  },
  {
    key: 'higher_rate_eng',
    type: 'band',
    regions: {
      earned: ['wal', 'eng', 'ni'],
      savings: ['wal', 'eng', 'sco', 'ni'],
      dividend: ['wal', 'eng', 'sco', 'ni'],
    },
  },
  {
    key: 'additional_rate_eng',
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
    {
      key: 'higher_rate_eng',
      bound_lower: 37700,
      bound_upper: 150000,
    },
    {
      key: 'additional_rate_eng',
      bound_lower: 150000,
      bound_upper: Infinity,
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
  year: PlanningYear['tax_year'],
  assumptions: CashflowAssumptions
) {
  if (knownRates[year]) {
    const knownRate = knownRates[year].find(rate => rate.key === key)
    if (knownRate)
      return {
        ...knownRate,
        ...{ remaining: knownRate.bound_upper - knownRate.bound_lower },
      }
    throw new Error(`Missing band rate (${key}) in year ${year}`)
  }

  const latestKnownYear = Object.keys(knownRates).at(-1) as string
  const latestKnownRates = knownRates[latestKnownYear].find(
    rate => rate.key === key
  )

  if (!latestKnownRates)
    throw new Error(`Missing band rate (${key}) in year ${year}`)

  const yearsAhead = +year.substring(0, 2) - +latestKnownYear.substring(0, 2)
  if (yearsAhead < 0) throw new Error('Can only project forwards')

  const [lower, upper] = (['bound_lower', 'bound_upper'] as const).map(bound =>
    assumptions.terms === 'real'
      ? latestKnownRates[bound]
      : latestKnownRates[bound] * assumptions.cpi ** yearsAhead
  )

  return {
    key,
    bound_lower: lower,
    bound_upper: upper,
    remaining: upper - lower,
  }
}

export function generateBandsFor(
  person: Person,
  year: PlanningYear['tax_year'],
  assumptions: CashflowAssumptions
): OutputTaxBand[] {
  return bands
    .filter(band => bandIsRelevantTo(person, band))
    .map(band => getRatesForBandInYear(band.key, year, assumptions))
}
