import { Band, PersonalAllowance, PlanningYear } from '../types'

export const bands: (Band | PersonalAllowance)[] = [
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
    rates: {
      earned: 0,
      savings: 0,
      dividend: 0,
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
    rates: {
      earned: 0.2,
      savings: 0.2,
      dividend: 0.0875,
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
    rates: {
      earned: 0.4,
      savings: 0.4,
      dividend: 0.3375,
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
    rates: {
      earned: 0.45,
      savings: 0.45,
      dividend: 0.3935,
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

export const knownRates: KnownRatesType = {
  2223: [
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
