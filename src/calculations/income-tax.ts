import { Dayjs } from 'dayjs'
import { round } from 'lodash'
import {
  Band,
  Cashflow,
  CashflowAssumptions,
  Income,
  Output,
  OutputTaxBand,
  Person,
  PlanningYear,
} from '../types'
import { bands, knownRates } from '../config/income-tax'
import { v4 } from 'uuid'

export function getTaxYearFromDate(date: Dayjs) {
  const year = date.year()
  const yearString = year.toString().substring(2)

  if (date.month() > 3 || (date.month() === 3 && date.date() >= 6))
    return `${yearString}${(year + 1).toString().substring(2)}`
  else return `${(year - 1).toString().substring(2)}${yearString}`
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
        ...{
          id: v4(),
          remaining: knownRate.bound_upper - knownRate.bound_lower,
        },
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
      : latestKnownRates[bound] * (1 + assumptions.cpi ** yearsAhead)
  )

  return {
    id: v4(),
    key,
    bound_lower: round(lower),
    bound_upper: round(upper),
    remaining: round(upper - lower),
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

export function calcIncomeTaxLiability(
  year: PlanningYear,
  cashflow: Cashflow,
  output: Output
) {
  cashflow.people.forEach(person => {
    const incomes = cashflow.incomes.filter(({ people }) =>
      people.some(({ id }) => id === person.id)
    )

    const totalIncome = getTotalIncome(incomes, year, output)
    const totalNetIncome = getTotalNetIncome()
    // determine adjusted net income
    // taper allowances
    // deduct allowances
    // apply band extensions
    // apply taxation
    // the above gives the provisional income tax liability
    // deduct tax reducers e.g. marriage allowance, EIS tax relief, top-slicing relief
    // add extra tax charges e.g. high income child benefit charge, annual allowance charge
  })
}

/**
 * Get the person's total income which comprises the following 8 categories:
 * employment, pension, social security, trading, property, savings,
 * dividend and miscellaneous.
 */
function getTotalIncome(
  baseIncomes: Income[],
  year: PlanningYear,
  output: Output
) {
  return baseIncomes.reduce(
    (acc, { id }) =>
      acc + output.incomes[id].years[getYearIndex(year, output)].gross_value,
    0
  )
}

/**
 * Get the person's net income for the year, which is their total income less
 * specified deductions (such as trading losses and payments made to gross
 * pension schemes (relief under net pay arrangements)).
 */
function getTotalNetIncome() {
  //
}

function getYearIndex(year: PlanningYear, output: Output) {
  return output.years.findIndex(({ tax_year }) => tax_year === year.tax_year)
}
