import { round } from 'lodash';
import {
  Account,
  BaseAccount,
  CashAccount,
  Cashflow,
  GIA,
  ISA,
  MoneyPurchase,
  Output,
  PlanningYear,
  UnwrappedAccount,
} from '../types';
import { applyGrowth as applyGrowthRate } from './growth';
import { getYearIndex } from './income-tax';

let yearIndex: number;

export function initialiseAccounts(
  year: PlanningYear,
  cashflow: Cashflow,
  output: Output
) {
  yearIndex = getYearIndex(year.tax_year, output);

  cashflow.accounts.forEach((account) => {
    const outputYear = output.accounts[account.id].years[yearIndex];

    // If the year index is 0, get the value from the base account valuations.
    // If it's not, get it from the previous year's end value.
    if (yearIndex === 0) {
      outputYear.start_value = account.valuations[0].value;
    } else {
      outputYear.start_value =
        output.accounts[account.id].years[yearIndex - 1].end_value;
    }

    outputYear.current_value = outputYear.start_value;
    outputYear.net_growth = getGrowthRateFromTemplate(account);
  });
}

export function initialiseMoneyPurchases(
  year: PlanningYear,
  cashflow: Cashflow,
  output: Output
) {
  yearIndex = getYearIndex(year.tax_year, output);

  cashflow.money_purchases.forEach((pension) => {
    const outputYear = output.money_purchases[pension.id].years[yearIndex];

    // If the year index is 0, get the value from the base valuations.
    // If it's not, get it from the previous year's end value.
    if (yearIndex === 0) {
      outputYear.start_value = pension.valuations[0].value;
      outputYear.start_value_uncrystallised =
        pension.valuations[0].uncrystallised_value ?? 0;
      outputYear.start_value_crystallised =
        pension.valuations[0].crystallised_value ?? 0;
    } else {
      const prev = output.money_purchases[pension.id].years[yearIndex - 1];
      outputYear.start_value = prev.end_value;
      outputYear.start_value_uncrystallised = prev.end_value_uncrystallised;
      outputYear.start_value_crystallised = prev.end_value_crystallised;
    }

    outputYear.current_value = outputYear.start_value;
    outputYear.current_value_uncrystallised =
      outputYear.start_value_uncrystallised;
    outputYear.current_value_crystallised = outputYear.start_value_crystallised;

    outputYear.net_growth = getGrowthRateFromTemplate(pension);
  });
}

function getGrowthRateFromTemplate(account: BaseAccount) {
  if (account.growth_template.type === 'flat') {
    return round(
      account.growth_template.rate.gross_rate -
        (account.growth_template.rate.charges ?? 0),
      4
    );
  }

  const item =
    account.growth_template.rate[
      yearIndex % account.growth_template.rate.length
    ];

  return round(item.gross_rate - (item.charges ?? 0), 4);
}

export function applyGrowth(cashflow: Cashflow, output: Output) {
  cashflow.accounts.forEach((account) => {
    const outputYear = output.accounts[account.id].years[yearIndex];

    const currentValue = outputYear.current_value ?? 0;
    const growthRate =
      currentValue < 0 ? 0 : getGrowthRateFromTemplate(account);

    const endValue =
      currentValue *
      applyGrowthRate(
        growthRate,
        cashflow.assumptions.terms === 'real' ? cashflow.assumptions.cpi : 0
      );

    outputYear.end_value = round(endValue, 2);
  });

  cashflow.money_purchases.forEach((pension) => {
    const outputYear = output.money_purchases[pension.id].years[yearIndex];

    const growable = [
      ['current_value', 'end_value'],
      ['current_value_uncrystallised', 'end_value_uncrystallised'],
      ['current_value_crystallised', 'end_value_crystallised'],
    ] as const;

    growable.forEach((item) => {
      const currentValue = outputYear[item[0]] ?? 0;
      const growthRate =
        currentValue < 0 ? 0 : getGrowthRateFromTemplate(pension);

      const endValue =
        currentValue *
        applyGrowthRate(
          growthRate,
          cashflow.assumptions.terms === 'real' ? cashflow.assumptions.cpi : 0
        );

      outputYear[item[1]] = round(endValue, 2);
    });
  });
}

export function isAccount(account: BaseAccount): account is Account {
  return account.section === 'accounts';
}

export function isCashAccount(account: BaseAccount): account is CashAccount {
  return isAccount(account) && account.category === 'cash';
}

export function isIsa(account: BaseAccount): account is ISA {
  return isAccount(account) && account.category === 'isa';
}

export function isUnwrappedInvestment(
  account: BaseAccount
): account is UnwrappedAccount {
  return isAccount(account) && account.category === 'unwrapped';
}

export function isBond(account: BaseAccount) {
  return isAccount(account) && account.category === 'bond';
}

export function isGia(account: BaseAccount): account is GIA {
  return isUnwrappedInvestment(account) && account.sub_category === 'gia';
}

export function isMoneyPurchase(
  account: BaseAccount
): account is MoneyPurchase {
  return account.section === 'money_purchases';
}

export const determineCategory = (a: BaseAccount) => {
  if (isCashAccount(a)) return 'cash';
  if (isUnwrappedInvestment(a)) return 'unwrapped';
  if (isBond(a)) return 'bonds';
  if (isIsa(a)) return 'isa';
  if (isMoneyPurchase(a)) return 'pensions';
};

export function areAdHocWithdrawalsSubjectToIncomeTax(account: BaseAccount) {
  if (isMoneyPurchase(account)) return true;
  if (isBond(account)) return true;
  if (isIsa(account) || isGia(account) || isCashAccount(account)) return false;
  // todo: cover more cases
  return false;
}
