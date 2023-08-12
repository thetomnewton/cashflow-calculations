export const incomeClasses = {
  employment: ['class1'],
  self_employment: ['class2', 'class4'],
}

export const taxableIncomeLimits = {
  lower_profits_limit: 12570,
  upper_profits_limit: 50270,
}

export const class1Rates = {
  below_lpl: 0,
  below_upl: 0.12,
  above_upl: 0.02,
}

export const minAge = 16

/**
 * The amount of tax paid per year, based on the total
 * self-employed profits of the person in that year.
 */
export const class2Tax = {
  below_lpl: 0,
  above_lpl: 163.8,
}

export const class4Tax = {
  below_lpl: 0,
  below_upl: 0.9,
  above_upl: 0.02,
}
