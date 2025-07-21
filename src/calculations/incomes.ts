import { round, sum, sumBy } from 'lodash';
import { date } from '../lib/date';
import {
  Cashflow,
  DefinedBenefitPension,
  EmploymentIncome,
  Income,
  MoneyPurchase,
  OtherTaxableIncome,
  Output,
  OutputIncomeYear,
  PlanningYear,
  SelfEmploymentIncome,
} from '../types';
import { getYearIndex } from './utils/dates';

export function setNetValues(
  year: PlanningYear,
  cashflow: Cashflow,
  output: Output
) {
  cashflow.incomes.forEach((income) => {
    const out =
      output.incomes[income.id].years[getYearIndex(year.tax_year, output)];

    if (!incomeIsTaxable(income, cashflow)) {
      out.net_value = out.gross_value;
      return;
    }

    out.net_value = out.gross_value;

    if (isEmployment(income))
      out.net_value += (out.bonus ?? 0) + (out.benefits ?? 0);

    out.net_value -= sum(Object.values(out.tax.ni_paid));
    out.net_value -= sumBy(Object.values(out.tax.bands), 'tax_paid');

    out.net_value = round(out.net_value, 2);
  });
}

export function isEmployment(income: Income): income is EmploymentIncome {
  return income.type === 'employment';
}

export function isSelfEmployment(
  income: Income
): income is SelfEmploymentIncome {
  return income.type === 'self_employment';
}

export function isOtherTaxableIncome(
  income: Income
): income is OtherTaxableIncome {
  return income.type === 'other_taxable';
}

export function getTaxableValue(
  income: Income,
  value: OutputIncomeYear,
  cashflow: Cashflow
) {
  if (!incomeIsTaxable(income, cashflow)) return 0;

  const baseFn = (value: OutputIncomeYear) => value.gross_value;

  return {
    employment: (value: OutputIncomeYear) =>
      value.gross_value + (value.bonus ?? 0) + (value.benefits ?? 0),
    self_employment: baseFn,
    dividend: baseFn,
    pension: (value: OutputIncomeYear) => {
      if (value.gross_value === 0) return 0;

      const dc: [MoneyPurchase, 'money_purchase'][] =
        cashflow.money_purchases.map((dc) => [dc, 'money_purchase']);

      const db: [DefinedBenefitPension, 'defined_benefit'][] =
        cashflow.defined_benefits.map((db) => [db, 'defined_benefit']);

      const pensions = [...dc, ...db];

      const source = pensions.find(
        (source) => source[0].id === income.source_id
      );
      if (!source) throw new Error('Missing source pension');

      if (source[1] === 'money_purchase') {
        return getTaxableValueForMoneyPurchase(source[0], income, value);
      } else if (source[1] === 'defined_benefit') {
        return getTaxableValueForDefinedBenefit(source[0], income, value);
      }

      throw new Error('Invalid pension type');
    },
    savings: baseFn,
    other_taxable: baseFn,
    other_non_taxable: () => 0,
  }[income.type](value);
}

function getTaxableValueForMoneyPurchase(
  pension: MoneyPurchase,
  income: Income,
  value: OutputIncomeYear
) {
  const withdrawal = pension.withdrawals.find(
    (w) => w.id === income.source_withdrawal_id
  );

  if (!withdrawal) throw new Error('Missing source withdrawal');
  const method = withdrawal.method;

  if (method === 'pcls') return 0;
  if (method === 'fad') return value.gross_value;
  if (method === 'ufpls') return value.gross_value * 0.75;

  throw new Error('Invalid method');
}

function getTaxableValueForDefinedBenefit(
  pension: DefinedBenefitPension,
  income: Income,
  value: OutputIncomeYear
) {
  // All pension income from a DB is taxable
  return value.gross_value;
}

export function incomeIsTaxable(income: Income, cashflow?: Cashflow) {
  if (income.type === 'other_non_taxable') return false;

  if (income.type !== 'pension' || !cashflow) return true;

  const mp = cashflow.money_purchases.find((p) => p.id === income.source_id);
  if (mp) {
    const withdrawal = mp.withdrawals.find(
      (w) => w.id === income.source_withdrawal_id
    );
    if (!withdrawal) return true;

    return withdrawal.method !== 'pcls';
  }

  // All defined benefit pension income is taxable
  return true;
}

export function getTotalDuration(income: Income) {
  return income.values.reduce(
    (acc, value) =>
      acc + date(value.ends_at).diff(date(value.starts_at), 'years'),
    0
  );
}
