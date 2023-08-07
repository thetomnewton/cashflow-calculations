import { Cashflow, Output } from '../types'
import { initBands, initIncomes, initYears, makeInitOutput } from './init'

export function run(cashflow: Cashflow): Output {
  const output = makeInitOutput(cashflow)

  initYears(cashflow, output)
  initBands(cashflow, output)
  initIncomes(cashflow, output)

  return output
}
