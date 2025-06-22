import { inRange, round } from 'lodash';
import {
  class1Rates,
  class2Tax,
  class4Rates,
  incomeClasses,
  minAge,
  taxableIncomeLimits,
} from '../config/national-insurance';
import {
  Cashflow,
  Income,
  Output,
  OutputIncomeYear,
  Person,
  PlanningYear,
  PossibleNICs,
} from '../types';
import { getYearIndex } from './income-tax';
import { ageAtDate, statePensionAge } from './person';

let taxYear: string;
let cashflow: Cashflow;
let output: Output;

type LimitsType = typeof taxableIncomeLimits;
type Class2TaxType = typeof class2Tax;

export function calcNICs(
  year: PlanningYear,
  baseCashflow: Cashflow,
  baseOutput: Output
) {
  taxYear = year.tax_year;
  cashflow = baseCashflow;
  output = baseOutput;

  cashflow.incomes
    .filter(incomeRelevantToNICs)
    .filter(({ people }) => people.every(shouldPayNICsThisYear))
    .reduce((acc, income) => {
      const outputYear =
        output.incomes[income.id].years[getYearIndex(year.tax_year, output)];

      const overallTotal = totalIncomeSubjectToNICs(income, outputYear);
      const totalForPerson = overallTotal / income.people.length;

      payNationalInsuranceOn(totalForPerson, income, outputYear, acc);

      return acc + totalForPerson;
    }, 0);
}

const incomeRelevantToNICs = ({ type }: Income) =>
  Object.keys(incomeClasses).includes(type);

function shouldPayNICsThisYear(person: Person) {
  const age = ageAtDate(
    person,
    output.years[getYearIndex(taxYear, output)].starts_at
  );

  return inRange(age, minAge, statePensionAge(person));
}

function totalIncomeSubjectToNICs(
  { type }: Income,
  outputYear: OutputIncomeYear
) {
  if (type === 'employment')
    return outputYear.gross_value + (outputYear.bonus ?? 0);
  return outputYear.gross_value;
}

function getProjectedLimits(
  limits: { [key: string]: number },
  terms: Cashflow['assumptions']['terms'],
  cpi: Cashflow['assumptions']['cpi']
) {
  return Object.fromEntries(
    Object.entries(limits).map(([key, value]) => {
      if (terms === 'real') return [key, value];

      const inflatedValue = value * (1 + cpi) ** getYearIndex(taxYear, output);
      return [key, round(inflatedValue, 2)];
    })
  );
}

function payNationalInsuranceOn(
  total: number,
  income: Income,
  outputYear: OutputIncomeYear,
  alreadyPaid: number
) {
  const NIClasses =
    incomeClasses[income.type as 'employment' | 'self_employment'];

  const projectedLimits = getProjectedLimits(
    taxableIncomeLimits,
    cashflow.assumptions.terms,
    cashflow.assumptions.cpi
  ) as LimitsType;

  const adjustedLimits = adjustLimitsForAlreadyPaid(
    projectedLimits,
    alreadyPaid
  ) as LimitsType;

  const projectedClass2Tax = getProjectedLimits(
    class2Tax,
    cashflow.assumptions.terms,
    cashflow.assumptions.cpi
  ) as Class2TaxType;

  NIClasses.forEach((className) => {
    outputYear.tax.ni_paid[className] = {
      class1: () => runClass1Calculation(total, adjustedLimits),
      class2: () =>
        runClass2Calculation(total, adjustedLimits, projectedClass2Tax),
      class4: () => runClass4Calculation(total, adjustedLimits),
    }[className as PossibleNICs]();
  });
}

function runClass1Calculation(total: number, limits: LimitsType) {
  let out = 0;
  out += Math.min(total, limits.lower_profits_limit) * class1Rates.below_lpl;

  out +=
    Math.max(
      0,
      Math.min(total, limits.upper_profits_limit) - limits.lower_profits_limit
    ) * class1Rates.below_upl;

  out +=
    Math.max(0, total - limits.upper_profits_limit) * class1Rates.above_upl;

  return round(out, 2);
}

function runClass2Calculation(
  total: number,
  incomeLimits: LimitsType,
  class2Limits: Class2TaxType
) {
  return round(
    total >= incomeLimits.small_profits_threshold
      ? class2Limits.above_spt
      : class2Limits.below_spt,
    2
  );
}

function runClass4Calculation(total: number, limits: LimitsType) {
  let out = 0;
  out += Math.min(total, limits.lower_profits_limit) * class4Rates.below_lpl;

  out +=
    Math.max(
      0,
      Math.min(total, limits.upper_profits_limit) - limits.lower_profits_limit
    ) * class4Rates.below_upl;

  out +=
    Math.max(0, total - limits.upper_profits_limit) * class4Rates.above_upl;

  return round(out, 2);
}

function adjustLimitsForAlreadyPaid(limits: LimitsType, alreadyPaid: number) {
  return Object.fromEntries(
    Object.entries(limits).map(([key, value]) => [
      key,
      Math.max(value - alreadyPaid, 0),
    ])
  );
}
