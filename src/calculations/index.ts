import { Cashflow, CashflowOutput } from '../types'

export function run(cashflow: Cashflow): CashflowOutput {
  return {
    starts_at: cashflow.starts_at,
    ends_at: cashflow.ends_at,
    periods: [],
  }
}
