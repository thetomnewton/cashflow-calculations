import { Cashflow, cashflowSchema, Output, PlanningYear } from '../types';
import {
  applyGrowth,
  initialiseAccounts,
  initialiseMoneyPurchases,
} from './accounts';
import { applyContributions } from './contributions';
import { applyExpenses } from './expenses';
import { setNetValues } from './incomes';
import { initialise } from './init';
import { calcNICs } from './national-insurance';
import { applyPlannedWithdrawals } from './planned-withdrawals';
import { IncomeTaxService } from './services/income-tax';

let output: Output;
let cashflow: Cashflow;

export function run(base: Cashflow): Output {
  cashflowSchema.parse(base);
  cashflow = base;
  output = initialise(cashflow);
  output.years.forEach(runYearCalculation);

  return output;
}

function runYearCalculation(year: PlanningYear) {
  initialiseAccounts(year, cashflow, output);
  initialiseMoneyPurchases(year, cashflow, output);
  applyContributions(year, cashflow, output);
  applyPlannedWithdrawals(year, cashflow, output);
  new IncomeTaxService(year, cashflow, output).calculate();
  calcNICs(year, cashflow, output);
  setNetValues(year, cashflow, output);
  applyExpenses(year, cashflow, output);
  applyGrowth(cashflow, output);
}
