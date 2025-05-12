import { Dayjs } from 'dayjs';
import { round, sumBy } from 'lodash';
import { v4 } from 'uuid';
import { bands, knownRates } from '../config/income-tax';
import { date } from '../lib/date';
import {
  Band,
  Cashflow,
  CashflowAssumptions,
  Income,
  IncomeTaxTypes,
  Output,
  OutputTaxBand,
  Person,
  PersonalAllowance,
  PlanningYear,
} from '../types';

let taxYear: string;

export function getTaxYearFromDate(initialDate: Dayjs | string) {
  const dateObj =
    typeof initialDate === 'string' ? date(initialDate) : initialDate;

  const year = dateObj.year();
  const yearString = year.toString().substring(2);

  if (dateObj.month() > 3 || (dateObj.month() === 3 && dateObj.date() >= 6))
    return `${yearString}${(year + 1).toString().substring(2)}`;
  else return `${(year - 1).toString().substring(2)}${yearString}`;
}

function bandIsRelevantTo(person: Person, band: Band) {
  return (
    band.regions.earned.includes(person.tax_residency) ||
    band.regions.savings.includes(person.tax_residency) ||
    band.regions.dividend.includes(person.tax_residency)
  );
}

function getRatesForBandInYear(
  key: Band['key'],
  year: PlanningYear['tax_year'],
  assumptions: CashflowAssumptions
) {
  if (knownRates[year]) {
    const knownRate = knownRates[year].find((rate) => rate.key === key);
    if (knownRate)
      return {
        ...knownRate,
        ...{
          id: v4(),
          remaining: knownRate.bound_upper - knownRate.bound_lower,
        },
      };
    throw new Error(`Missing band rate (${key}) in year ${year}`);
  }

  const latestKnownYear = Object.keys(knownRates).at(-1) as string;
  const latestKnownRates = knownRates[latestKnownYear].find(
    (rate) => rate.key === key
  );

  if (!latestKnownRates)
    throw new Error(`Missing band rate (${key}) in year ${year}`);

  const yearsAhead = +year.substring(0, 2) - +latestKnownYear.substring(0, 2);

  if (yearsAhead < 0) throw new Error('Can only project forwards');

  const [lower, upper] = (['bound_lower', 'bound_upper'] as const).map(
    (bound) =>
      assumptions.terms === 'real'
        ? latestKnownRates[bound]
        : latestKnownRates[bound] * (1 + assumptions.cpi ** yearsAhead)
  );

  return {
    id: v4(),
    key,
    bound_lower: round(lower),
    bound_upper: round(upper),
    remaining: round(upper - lower),
  };
}

export function generateBandsFor(
  person: Person,
  year: PlanningYear['tax_year'],
  assumptions: CashflowAssumptions
): OutputTaxBand[] {
  return bands
    .filter((band) => bandIsRelevantTo(person, band))
    .map((band) => getRatesForBandInYear(band.key, year, assumptions));
}

export function calcIncomeTaxLiability(
  year: PlanningYear,
  cashflow: Cashflow,
  output: Output
) {
  taxYear = year.tax_year;

  cashflow.people.forEach((person) => {
    const incomes = cashflow.incomes.filter(({ people }) =>
      people.some(({ id }) => id === person.id)
    );

    const totalIncome = getTotalIncome(incomes, year, output);
    const totalNetIncome = getTotalNetIncome(totalIncome);
    const adjustedNetIncome = getAdjustedNetIncome(totalNetIncome);

    taperAllowances(person, output, adjustedNetIncome);
    deductAllowances(person, output, incomes);
    extendTaxBands(person, output);
    useTaxBands(person, output, incomes);
    // the above gives the provisional income tax liability
    // deduct tax reducers e.g. marriage allowance, EIS tax relief, top-slicing relief
    // add extra tax charges e.g. high income child benefit charge, annual allowance charge
  });
}

/**
 * Get the person's total (taxable) income which comprises the following 8 categories:
 * employment, pension, social security, trading, property, savings,
 * dividend and miscellaneous.
 */
function getTotalIncome(
  baseIncomes: Income[],
  year: PlanningYear,
  output: Output
) {
  return baseIncomes.reduce((total, income) => {
    const outputYearValue =
      output.incomes[income.id].years[getYearIndex(year.tax_year, output)];

    return total + outputYearValue.taxable_value / income.people.length;
  }, 0);
}

/**
 * Get the person's net income for the year, which is their total income less
 * specified deductions (such as trading losses and payments made to gross
 * pension schemes (relief under net pay arrangements)).
 */
function getTotalNetIncome(totalIncome: number) {
  return totalIncome;
}

function getAdjustedNetIncome(netIncome: number) {
  // todo: deduct gift aid donations

  // Provisionally set the net income
  let adjustedNetIncome = netIncome;

  // todo: deduct any RAS pension contributions that were paid net
  // todo: re-add tax reliefs deducted from net pay

  return adjustedNetIncome;
}

function taperAllowances(
  person: Person,
  output: Output,
  adjustedNetIncome: number
) {
  taperPersonalAllowance(person, output, adjustedNetIncome);
  // todo: taper starting rate for savings
  // todo: taper personal savings allowance
}

/**
 * Taper the person's Personal Allowance. Requires the
 * taxYear to have already been set elsewhere.
 */
function taperPersonalAllowance(
  person: Person,
  output: Output,
  adjustedNetIncome: number
) {
  const pa = output.tax.bands[taxYear][person.id].find(
    (band) => band.key === 'personal_allowance'
  );
  if (!pa) throw new Error(`No Personal Allowance in ${taxYear}`);

  const bandConfig = bands.find(isPersonalAllowance);
  if (!bandConfig)
    throw new Error(`No Personal Allowance config in ${taxYear}`);

  // If PA already tapered, don't taper again
  if (
    typeof pa.bound_upper_original !== 'undefined' &&
    pa.bound_upper_original > pa.bound_upper
  )
    return;

  const surplus = adjustedNetIncome - bandConfig.adjusted_net_income_limit;
  if (surplus <= 0) return;

  const newUpperBound = Math.max(
    0,
    pa.bound_upper - surplus * bandConfig.taper_rate
  );

  pa.bound_upper_original = pa.bound_upper;

  pa.bound_upper = newUpperBound;
  pa.remaining = newUpperBound;
}

function isPersonalAllowance(
  band: Band | PersonalAllowance
): band is PersonalAllowance {
  return band.key === 'personal_allowance';
}

/**
 * Deduct any allowances from the taxable portion of each income in the correct
 * order, to reveal the amount of each income on which any tax is due.
 * Allowances are deducted in the most tax-efficient way.
 */
function deductAllowances(person: Person, output: Output, incomes: Income[]) {
  // Get all output allowances
  const allowanceKeys = bands
    .filter(({ type }) => type === 'allowance')
    .map(({ key }) => key);

  const allowances = output.tax.bands[taxYear][person.id].filter(
    ({ key, remaining }) => allowanceKeys.includes(key) && remaining > 0
  );

  incomes.forEach((income) => {
    let unusedTotal = getTaxableUnusedTotal(income, output);
    if (unusedTotal <= 0) return;

    const outputYear =
      output.incomes[income.id].years[getYearIndex(taxYear, output)];

    // Go through each allowance and deduct it from the taxable income value
    allowances
      .filter((allowance) => {
        const bandDefinition = bands.find(({ key }) => key === allowance.key);
        if (!bandDefinition) throw new Error('Missing tax band definition');

        const taxCategory = getIncomeTaxCategory(income);
        if (taxCategory === 'non_taxable') return false;

        return bandDefinition.regions[taxCategory].includes(
          person.tax_residency
        );
      })
      // Sort allowances in the most tax-efficient way
      .sort((a, b) => {
        const category = getIncomeTaxCategory(income) as IncomeTaxTypes;
        const rateA = bands.find(({ key }) => key === a.key)?.rates[category];
        const rateB = bands.find(({ key }) => key === b.key)?.rates[category];

        if (typeof rateA === 'undefined' || typeof rateB === 'undefined')
          return 0;

        return rateA - rateB;
      })
      .forEach((allowance) => {
        const used = Math.min(allowance.remaining, unusedTotal);
        if (used <= 0) return;

        outputYear.tax.bands[allowance.key] = {
          used,
          tax_paid: 0, // todo: use actual rate from configs?
        };

        allowance.remaining -= used;
        unusedTotal -= used;
      });
  });
}

function getTaxableUnusedTotal(income: Income, output: Output) {
  const outputYear =
    output.incomes[income.id].years[getYearIndex(taxYear, output)];

  // Get the total of the taxable value which has not
  // yet been accounted for by any other bands.
  const value =
    taxableValuePerPersonThisYear(income, output) -
    sumBy(Object.values(outputYear.tax.bands), 'used');

  return round(value, 2);
}

/**
 * Where appropriate, extend the basic band and higher rate limit for
 * gross gift aid payments and gross RAS pension contributions
 */
function extendTaxBands(person: Person, output: Output) {
  // todo: extend bands where needed
}

/**
 * Use the tax bands to apply taxation to each income for a person.
 */
function useTaxBands(person: Person, output: Output, incomes: Income[]) {
  // Get all output bands
  const bandKeys = bands
    .filter(({ type }) => type === 'band')
    .map(({ key }) => key);

  const bandsToUse = output.tax.bands[taxYear][person.id].filter(
    ({ key, remaining }) => bandKeys.includes(key) && remaining > 0
  );

  const categorised = {
    earned: incomes.filter(isEarnedIncome),
    savings: incomes.filter(isSavingsIncome),
    dividend: incomes.filter(isDividendIncome),
  };

  Object.entries(categorised).forEach(([category, values]) => {
    values.forEach((income) => {
      let unusedTotal = getTaxableUnusedTotal(income, output);
      if (unusedTotal <= 0) return;

      const outputYear =
        output.incomes[income.id].years[getYearIndex(taxYear, output)];

      // Go through each allowance and deduct it from the taxable income value
      bandsToUse
        .filter((band) => {
          const bandDefinition = bands.find(({ key }) => key === band.key);
          if (!bandDefinition) throw new Error('Missing tax band definition');

          return bandDefinition.regions[category as IncomeTaxTypes].includes(
            person.tax_residency
          );
        })
        .forEach((band) => {
          const used = Math.min(band.remaining, unusedTotal);
          if (used <= 0) return;

          const bandDefinition = bands.find(({ key }) => key === band.key);
          if (!bandDefinition) throw new Error('Missing tax band definition');

          const taxCategory = getIncomeTaxCategory(income);
          if (taxCategory === 'non_taxable')
            throw new Error('Taxing non-taxable income');

          outputYear.tax.bands[band.key] = {
            used,
            tax_paid: round(used * bandDefinition.rates[taxCategory], 2),
          };

          band.remaining -= used;
          unusedTotal -= used;
        });
    });
  });
}

export function getYearIndex(year: PlanningYear['tax_year'], output: Output) {
  return output.years.findIndex(({ tax_year }) => tax_year === year);
}

function taxableValuePerPersonThisYear(income: Income, output: Output) {
  const outputYear =
    output.incomes[income.id].years[getYearIndex(taxYear, output)];

  return outputYear.taxable_value / income.people.length;
}

const isEarnedIncome = (i: Income) =>
  ['employment', 'self_employment', 'pension', 'other_taxable'].includes(
    i.type
  );

const isSavingsIncome = (i: Income) => i.type === 'savings';

const isDividendIncome = (i: Income) => i.type === 'dividend';

function getIncomeTaxCategory(income: Income) {
  if (income.type === 'other_non_taxable') return 'non_taxable';
  if (isEarnedIncome(income)) return 'earned';
  if (isSavingsIncome(income)) return 'savings';
  if (isDividendIncome(income)) return 'dividend';
  throw new Error('Unknown income tax category');
}

export function undoIncomeTaxation(
  year: PlanningYear,
  cashflow: Cashflow,
  output: Output
) {
  const idx = getYearIndex(year.tax_year, output);

  cashflow.incomes.forEach((income) => {
    const outputYear = output.incomes[income.id].years[idx];
    outputYear.tax.bands = {};
  });

  cashflow.people.forEach((person) => {
    output.tax.bands[year.tax_year][person.id].forEach((band) => {
      band.remaining = band.bound_upper;
    });
  });
}
