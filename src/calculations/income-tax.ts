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

  if (!latestKnownRates) {
    throw new Error(`Missing band rate (${key}) in year ${year}`);
  }

  const yearsAhead = +year.substring(0, 2) - +latestKnownYear.substring(0, 2);

  if (yearsAhead < 0) {
    throw new Error('Can only project forwards');
  }

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

export function getYearIndex(year: PlanningYear['tax_year'], output: Output) {
  return output.years.findIndex(({ tax_year }) => tax_year === year);
}

export class IncomeTaxCalculator {
  private readonly taxYear: string;
  private incomes: Income[] = [];

  constructor(
    private readonly year: PlanningYear,
    private readonly cashflow: Cashflow,
    private readonly output: Output
  ) {
    this.taxYear = this.year.tax_year;
  }

  public calculate() {
    this.cashflow.people.forEach((person) => {
      this.incomes = this.cashflow.incomes.filter(({ people }) =>
        people.some(({ id }) => id === person.id)
      );

      const totalIncome = this.getTotalIncome();
      const totalNetIncome = this.getTotalNetIncome(totalIncome);
      const adjustedNetIncome = this.getAdjustedNetIncome(totalNetIncome);

      this.taperAllowances(person, adjustedNetIncome);
      this.deductAllowances(person);
      this.extendTaxBands(person);
      this.useTaxBands(person);

      // todo:
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
  private getTotalIncome() {
    return this.incomes.reduce((total, income) => {
      const outputYearValue =
        this.output.incomes[income.id].years[
          getYearIndex(this.taxYear, this.output)
        ];

      return total + outputYearValue.taxable_value / income.people.length;
    }, 0);
  }

  /**
   * Get the person's net income for the year, which is their total income less
   * specified deductions (such as trading losses and payments made to gross
   * pension schemes (relief under net pay arrangements)).
   */
  private getTotalNetIncome(totalIncome: number) {
    return totalIncome;
  }

  private getAdjustedNetIncome(netIncome: number) {
    // todo: deduct gift aid donations

    // Provisionally set the net income
    let adjustedNetIncome = netIncome;

    // todo: deduct any RAS pension contributions that were paid net
    // todo: re-add tax reliefs deducted from net pay

    return adjustedNetIncome;
  }

  private taperAllowances(person: Person, adjustedNetIncome: number) {
    this.taperPersonalAllowance(person, adjustedNetIncome);
    // todo: taper starting rate for savings
    // todo: taper personal savings allowance
  }

  /**
   * Taper the person's Personal Allowance. Requires the
   * taxYear to have already been set elsewhere.
   */
  private taperPersonalAllowance(person: Person, adjustedNetIncome: number) {
    const pa = this.output.tax.bands[this.taxYear][person.id].find(
      (band) => band.key === 'personal_allowance'
    );
    if (!pa) throw new Error(`No Personal Allowance in ${this.taxYear}`);

    const bandConfig = bands.find(this.isPersonalAllowance);
    if (!bandConfig)
      throw new Error(`No Personal Allowance config in ${this.taxYear}`);

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

  /**
   * Deduct any allowances from the taxable portion of each income in the correct
   * order, to reveal the amount of each income on which any tax is due.
   * Allowances are deducted in the most tax-efficient way.
   */
  private deductAllowances(person: Person) {
    // Get all output allowances
    const allowanceKeys = bands
      .filter(({ type }) => type === 'allowance')
      .map(({ key }) => key);

    const allowances = this.output.tax.bands[this.taxYear][person.id].filter(
      ({ key, remaining }) => allowanceKeys.includes(key) && remaining > 0
    );

    this.incomes.forEach((income) => {
      let unusedTotal = this.getTaxableUnusedTotal(income);
      if (unusedTotal <= 0) return;

      const outputYear =
        this.output.incomes[income.id].years[
          getYearIndex(this.taxYear, this.output)
        ];

      // Go through each allowance and deduct it from the taxable income value
      allowances
        .filter((allowance) => {
          const bandDefinition = bands.find(({ key }) => key === allowance.key);
          if (!bandDefinition) throw new Error('Missing tax band definition');

          const taxCategory = this.getIncomeTaxCategory(income);
          if (taxCategory === 'non_taxable') return false;

          return bandDefinition.regions[taxCategory].includes(
            person.tax_residency
          );
        })
        // Sort allowances in the most tax-efficient way
        .sort((a, b) => {
          const category = this.getIncomeTaxCategory(income) as IncomeTaxTypes;
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

  private isPersonalAllowance(
    band: Band | PersonalAllowance
  ): band is PersonalAllowance {
    return band.key === 'personal_allowance';
  }

  private getTaxableUnusedTotal(income: Income) {
    const outputYear =
      this.output.incomes[income.id].years[
        getYearIndex(this.taxYear, this.output)
      ];

    // Get the total of the taxable value which has not
    // yet been accounted for by any other bands.
    const value =
      this.taxableValuePerPersonThisYear(income) -
      sumBy(Object.values(outputYear.tax.bands), 'used');

    return round(value, 2);
  }

  private taxableValuePerPersonThisYear(income: Income) {
    const outputYear =
      this.output.incomes[income.id].years[
        getYearIndex(this.taxYear, this.output)
      ];

    return outputYear.taxable_value / income.people.length;
  }

  /**
   * Where appropriate, extend the basic band and higher rate limit for
   * gross gift aid payments and gross RAS pension contributions
   */
  private extendTaxBands(person: Person) {
    // todo: extend bands where needed
  }

  /**
   * Use the tax bands to apply taxation to each income for a person.
   */
  private useTaxBands(person: Person) {
    // Get all output bands
    const bandKeys = bands
      .filter(({ type }) => type === 'band')
      .map(({ key }) => key);

    const bandsToUse = this.output.tax.bands[this.taxYear][person.id].filter(
      ({ key, remaining }) => bandKeys.includes(key) && remaining > 0
    );

    const categorised = {
      earned: this.incomes.filter(this.isEarnedIncome),
      savings: this.incomes.filter(this.isSavingsIncome),
      dividend: this.incomes.filter(this.isDividendIncome),
    };

    Object.entries(categorised).forEach(([category, values]) => {
      values.forEach((income) => {
        let unusedTotal = this.getTaxableUnusedTotal(income);
        if (unusedTotal <= 0) return;

        const outputYear =
          this.output.incomes[income.id].years[
            getYearIndex(this.taxYear, this.output)
          ];

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

            const taxCategory = this.getIncomeTaxCategory(income);
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

  private getIncomeTaxCategory(income: Income): IncomeTaxTypes | 'non_taxable' {
    if (income.type === 'other_non_taxable') return 'non_taxable';
    if (this.isEarnedIncome(income)) return 'earned';
    if (this.isSavingsIncome(income)) return 'savings';
    if (this.isDividendIncome(income)) return 'dividend';
    throw new Error(`Unknown income tax category: ${income.type}`);
  }

  private isEarnedIncome(i: Income) {
    return [
      'employment',
      'self_employment',
      'pension',
      'other_taxable',
    ].includes(i.type);
  }

  private isSavingsIncome(i: Income) {
    return i.type === 'savings';
  }

  private isDividendIncome(i: Income) {
    return i.type === 'dividend';
  }
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
