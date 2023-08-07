import { clone } from 'lodash'
import { date } from '../lib/date'
import { Cashflow, Output } from '../types'
import { v4 as uuid } from 'uuid'

export function run(cashflow: Cashflow): Output {
  let output: Output = {
    starts_at: cashflow.starts_at,
    years: [],
  }

  const initialiseYears = () => {
    output.years = [...Array(cashflow.years)].map((_, idx) => {
      const startDate = date(cashflow.starts_at)
      return {
        id: uuid(),
        starts_at: clone(startDate).add(idx, 'year').toISOString(),
        ends_at: clone(startDate)
          .add(idx + 1, 'year')
          .toISOString(),
      }
    })
  }

  initialiseYears()

  return output
}
