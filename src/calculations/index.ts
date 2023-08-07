import { Cashflow, Output } from '../types'
import { initialise } from './init'

export function run(cashflow: Cashflow): Output {
  const output = initialise(cashflow)

  return output
}
