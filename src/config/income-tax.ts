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
