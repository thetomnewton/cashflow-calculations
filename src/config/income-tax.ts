import { Band, PersonalAllowance, PlanningYear } from '../types';

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
    key: 'dividend_allowance',
    type: 'allowance',
    regions: {
      earned: [],
      savings: [],
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
  {
    key: 'starter_rate_sco',
    type: 'band',
    regions: {
      earned: ['sco'],
      savings: [],
      dividend: [],
    },
    rates: {
      earned: 0.19,
      savings: 0,
      dividend: 0,
    },
  },
  {
    key: 'basic_rate_sco',
    type: 'band',
    extends_for_ras_contributions: true,
    regions: {
      earned: ['sco'],
      savings: [],
      dividend: [],
    },
    rates: {
      earned: 0.2,
      savings: 0,
      dividend: 0,
    },
  },
  {
    key: 'intermediate_rate_sco',
    type: 'band',
    regions: {
      earned: ['sco'],
      savings: [],
      dividend: [],
    },
    rates: {
      earned: 0.21,
      savings: 0,
      dividend: 0,
    },
  },
  {
    key: 'higher_rate_sco',
    type: 'band',
    regions: {
      earned: ['sco'],
      savings: [],
      dividend: [],
    },
    rates: {
      earned: 0.42,
      savings: 0,
      dividend: 0,
    },
  },
  {
    key: 'advanced_rate_sco',
    type: 'band',
    regions: {
      earned: ['sco'],
      savings: [],
      dividend: [],
    },
    rates: {
      earned: 0.45,
      savings: 0,
      dividend: 0,
    },
  },
  {
    key: 'top_rate_sco',
    type: 'band',
    regions: {
      earned: ['sco'],
      savings: [],
      dividend: [],
    },
    rates: {
      earned: 0.48,
      savings: 0,
      dividend: 0,
    },
  },
];

type KnownRatesType = {
  [key: PlanningYear['tax_year']]: {
    key: Band['key'];
    bound_lower: number;
    bound_upper: number;
  }[];
};

export const knownRates: KnownRatesType = {
  2526: [
    { key: 'personal_allowance', bound_lower: 0, bound_upper: 12570 },
    { key: 'dividend_allowance', bound_lower: 0, bound_upper: 500 },
    { key: 'basic_rate_eng', bound_lower: 0, bound_upper: 37700 },
    { key: 'higher_rate_eng', bound_lower: 37700, bound_upper: 150000 },
    { key: 'additional_rate_eng', bound_lower: 150000, bound_upper: Infinity },
    { key: 'starter_rate_sco', bound_lower: 0, bound_upper: 15397 },
    { key: 'basic_rate_sco', bound_lower: 15397, bound_upper: 27491 },
    { key: 'intermediate_rate_sco', bound_lower: 27491, bound_upper: 43662 },
    { key: 'higher_rate_sco', bound_lower: 43662, bound_upper: 75000 },
    { key: 'advanced_rate_sco', bound_lower: 75000, bound_upper: 125140 },
    { key: 'top_rate_sco', bound_lower: 125140, bound_upper: Infinity },
  ],
};
