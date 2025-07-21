import { round } from 'lodash';
import {
  Account,
  BaseAccount,
  Cashflow,
  MoneyPurchaseWithdrawal,
  Output,
  OutputMoneyPurchaseYear,
  PlanningYear,
} from '../types';
import {
  areAdHocWithdrawalsSubjectToIncomeTax,
  determineCategory,
  isAccount,
  isMoneyPurchase,
} from './accounts';
import { undoIncomeTaxation } from './income-tax';
import { setNetValues } from './incomes';
import {
  withdrawGrossValueFromAccount,
  withdrawGrossValueFromMoneyPurchase,
} from './planned-withdrawals';
import { IncomeTaxService } from './services/income-tax';
import { getYearIndex } from './utils/dates';

let year: PlanningYear;
let yearIndex: number;
let cashflow: Cashflow;
let output: Output;

const MAX_RECURSION_ATTEMPTS = 25;

const sortByTaxCategory = (a: BaseAccount, b: BaseAccount) => {
  const priorityOrder = {
    cash: 0,
    unwrapped: 1,
    bonds: 2,
    isa: 3,
    pensions: 4,
    other: 5,
  };

  return (
    priorityOrder[determineCategory(a) ?? 'other'] -
    priorityOrder[determineCategory(b) ?? 'other']
  );
};

const sortByCustomOrder = (a: BaseAccount, b: BaseAccount) => {
  const order = cashflow.assumptions.custom_liquidation_order ?? [];
  let idxA = order.findIndex((x) => x === a.id);
  let idxB = order.findIndex((x) => x === b.id);

  // If an item is not found in the list, put it to the bottom
  if (idxA < 0) idxA = Infinity;
  if (idxB < 0) idxB = Infinity;
  return idxA - idxB;
};

export function applyExpenses(
  baseYear: PlanningYear,
  baseCashflow: Cashflow,
  baseOutput: Output
) {
  year = baseYear;
  cashflow = baseCashflow;
  output = baseOutput;
  yearIndex = getYearIndex(year.tax_year, output);

  const windfallOrShortfall = determineWindfallOrShortfall();

  if (windfallOrShortfall === 0) return;

  if (windfallOrShortfall > 0) handleWindfall(round(windfallOrShortfall, 2));
  else handleShortfall();
}

function determineWindfallOrShortfall() {
  const totalIncome = cashflow.incomes.reduce((total, income) => {
    return total + output.incomes[income.id].years[yearIndex].net_value;
  }, 0);

  const totalExpenses = cashflow.expenses.reduce((total, expense) => {
    return total + output.expenses[expense.id].years[yearIndex].value;
  }, 0);

  return totalIncome - totalExpenses;
}

function handleWindfall(initialWindfall: number) {
  if (initialWindfall < 0) throw new Error('Negative windfall');
  let remainingWindfall = initialWindfall;

  // If the sweep account is below zero, firstly attempt to get that back to
  // zero with some, or all, of the windfall.
  const sweep = cashflow.accounts.find((acc) => acc.is_sweep);
  if (!sweep) throw new Error('Missing sweep account');

  const currentSweepValue =
    output.accounts[sweep.id].years[yearIndex].current_value ?? 0;

  // Bring the sweep account value back from below 0, if we can
  if (currentSweepValue < 0) {
    const amountToSave = Math.min(remainingWindfall, currentSweepValue * -1);

    output.accounts[sweep.id].years[yearIndex].current_value =
      (output.accounts[sweep.id].years[yearIndex].current_value ?? 0) +
      amountToSave;

    remainingWindfall -= amountToSave;
  }

  // Move the remaining windfall based on the settings
  if (cashflow.assumptions.windfall_save === 'sweep') {
    output.accounts[sweep.id].years[yearIndex].current_value =
      (output.accounts[sweep.id].years[yearIndex].current_value ?? 0) +
      remainingWindfall;
  } else if (cashflow.assumptions.windfall_save === 'discard') {
    // todo: discard any surplus income which didn't come from one-off income
  }
}

// Liquidate some accounts in order to cover the deficit.
function handleShortfall() {
  // Get the liquid assets and sort them into the correct order
  const liquidAssets = getAvailableLiquidAssets();

  // Make some ad-hoc withdrawals.
  drawFromLiquidAssets(sortAssetsIntoLiquidationOrder(liquidAssets));
}

function getAvailableLiquidAssets() {
  return [
    ...cashflow.accounts.filter((acc) => {
      // todo: add more logic around if this can be liquidated or not
      if (acc.is_sweep) return false;
      return (output.accounts[acc.id].years[yearIndex].current_value ?? 0) > 0;
    }),
    ...cashflow.money_purchases.filter((pension) => {
      // todo: add more logic around if this can be liquidated or not,
      // e.g. if the pension access age is met yet
      return (
        (output.money_purchases[pension.id].years[yearIndex].current_value ??
          0) > 0
      );
    }),
  ];
}

function sortAssetsIntoLiquidationOrder(accounts: BaseAccount[]) {
  const strategy = cashflow.assumptions.liquidation_strategy;

  if (strategy === 'taxation') return accounts.toSorted(sortByTaxCategory);
  if (strategy === 'custom') return accounts.toSorted(sortByCustomOrder);

  return accounts;
}

function drawFromLiquidAssets(liquidAssets: BaseAccount[]) {
  // If we just made any ad-hoc withdrawals, especially if
  // the withdrawals were taxable, we need to re-tax
  // everything and see if the shortfall was met.

  for (const asset of liquidAssets) {
    const netIncomeNeeded = determineWindfallOrShortfall() * -1;
    if (netIncomeNeeded === 0) break;

    const taxable = areAdHocWithdrawalsSubjectToIncomeTax(asset);

    if (!taxable) {
      const accountValue: number =
        output[asset.section][asset.id].years[yearIndex].current_value ?? 0;
      const withdrawal = Math.min(netIncomeNeeded, accountValue);
      withdrawGrossValueFromAccount(asset as Account, withdrawal, true);
      undoIncomeTaxation(year, cashflow, output);
      new IncomeTaxService(year, cashflow, output).calculate();
      setNetValues(year, cashflow, output);
      continue;
    }

    attemptToResolveShortfallFromTaxableSource(asset);
  }

  const netIncomeNeeded = round(determineWindfallOrShortfall() * -1);
  // If there is still a shortfall at this point, take the sweep account into an overdraft

  if (netIncomeNeeded > 0) {
    const sweep = cashflow.accounts.find((acc) => acc.is_sweep);
    if (!sweep) throw new Error('Missing sweep account');

    output.accounts[sweep.id].years[yearIndex].current_value = round(
      (output.accounts[sweep.id].years[yearIndex].current_value ?? 0) -
        netIncomeNeeded,
      2
    );
  }
}

function attemptToResolveShortfallFromTaxableSource(account: BaseAccount) {
  const accountValue: number =
    output[account.section][account.id].years[yearIndex].current_value ?? 0;

  const netIncomeNeeded = determineWindfallOrShortfall() * -1;

  // If the account value is less than the net income need, withdraw the whole pot
  if (accountValue <= netIncomeNeeded) {
    withdrawGrossAmountAndRetaxIncomes(account, accountValue);
    return;
  }

  // If we reach this point, we know the account value is more than the net income need

  // Withdraw the whole pot. If there is still a shortfall, do that and move on,
  // otherwise, if we withdrew too much then undo what we just did
  withdrawGrossAmountAndRetaxIncomes(account, accountValue);

  let newNetIncomeNeed = determineWindfallOrShortfall() * -1;
  if (newNetIncomeNeed >= 0) return;

  // we withdrew too much, undo everything we just did
  removeAdHocWithdrawalsFromAccountThisYear(account);
  undoIncomeTaxation(year, cashflow, output);
  new IncomeTaxService(year, cashflow, output).calculate();
  setNetValues(year, cashflow, output);
  newNetIncomeNeed = determineWindfallOrShortfall() * -1;

  let [min, max] = [newNetIncomeNeed, accountValue];

  let attempts = 0;
  let amountToTry = min + (max - min) / 2;

  while (attempts < MAX_RECURSION_ATTEMPTS) {
    withdrawGrossAmountAndRetaxIncomes(account, amountToTry);
    const windfall = determineWindfallOrShortfall() * -1;
    if (round(windfall, 1) === 0) break;

    removeAdHocWithdrawalsFromAccountThisYear(account);
    undoIncomeTaxation(year, cashflow, output);
    new IncomeTaxService(year, cashflow, output).calculate();
    setNetValues(year, cashflow, output);

    if (windfall < 0) max = amountToTry;
    else min = amountToTry;

    amountToTry = min + (max - min) / 2;
    attempts++;
  }
}

function withdrawGrossAmountAndRetaxIncomes(
  account: BaseAccount,
  amount: number
) {
  if (isAccount(account)) {
    withdrawGrossValueFromAccount(account, amount, true);
  } else if (isMoneyPurchase(account)) {
    withdrawGrossValueFromMoneyPurchase(account, amount, 'ufpls', true);
  }
  undoIncomeTaxation(year, cashflow, output);
  new IncomeTaxService(year, cashflow, output).calculate();
  setNetValues(year, cashflow, output);
}

function removeAdHocWithdrawalsFromAccountThisYear(account: BaseAccount) {
  const tracker: { value: number; method: string | undefined }[] = [];

  account.withdrawals = account.withdrawals.filter((w) => {
    if (
      w.ad_hoc &&
      w.starts_at === year.starts_at &&
      w.ends_at === year.ends_at
    ) {
      tracker.push({
        value: w.value,
        method: isMoneyPurchase(account)
          ? (w as MoneyPurchaseWithdrawal).method
          : undefined,
      });
      return false;
    }
    return true;
  });

  cashflow.incomes = cashflow.incomes.filter((inc) => {
    if (
      inc.ad_hoc &&
      inc.source_id === account.id &&
      inc.values.length &&
      inc.values[0].starts_at === year.starts_at &&
      inc.values[0].ends_at === year.ends_at
    ) {
      delete output.incomes[inc.id];
      return false;
    }
    return true;
  });

  tracker.forEach((withdrawal) => {
    const outputYear = output[account.section][account.id].years[yearIndex];

    // todo: update the current value of the account to restore the money that was taken
    outputYear.current_value = outputYear.current_value
      ? outputYear.current_value + withdrawal.value
      : withdrawal.value;

    if (isMoneyPurchase(account)) {
      const out = outputYear as OutputMoneyPurchaseYear;

      if (withdrawal.method === 'ufpls') {
        out.current_value_uncrystallised = out.current_value_uncrystallised
          ? out.current_value_uncrystallised + withdrawal.value
          : withdrawal.value;
      } else if (withdrawal.method === 'pcls') {
        out.current_value_uncrystallised = out.current_value_uncrystallised
          ? out.current_value_uncrystallised + withdrawal.value * 4
          : withdrawal.value * 4;

        out.current_value_crystallised = out.current_value_crystallised
          ? out.current_value_crystallised + withdrawal.value * -3
          : withdrawal.value * -3;
      } else if (withdrawal.method === 'fad') {
        out.current_value_crystallised = out.current_value_crystallised
          ? out.current_value_crystallised + withdrawal.value
          : withdrawal.value;
      }
    }
  });
}
