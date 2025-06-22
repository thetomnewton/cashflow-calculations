export const incomeClasses = {
  employment: ['class1'],
  self_employment: ['class2', 'class4'],
};

export const taxableIncomeLimits = {
  lower_profits_limit: 12570,
  upper_profits_limit: 50270,
  small_profits_threshold: 6845,
};

export const class1Rates = {
  below_lpl: 0,
  below_upl: 0.08,
  above_upl: 0.02,
};

export const minAge = 16;

/**
 * The amount of tax paid per year, based on the total
 * self-employed profits of the person in that year.
 */
export const class2Tax = {
  below_spt: 0,
  above_spt: 3.5 * 52, // £182
};

export const class4Rates = {
  below_lpl: 0,
  below_upl: 0.06,
  above_upl: 0.02,
};
