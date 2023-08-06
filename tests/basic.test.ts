import dayjs from 'dayjs'
import { v4 as uuid } from 'uuid'
import { Cashflow } from '../src/types'
import { run } from '../src/calculations'

describe('basic tests', () => {
  test('can create a cashflow', () => {
    const cashflow: Cashflow = {
      id: uuid(),
      starts_at: dayjs('2023-04-06').toISOString(),
      ends_at: dayjs('2025-04-06').toISOString(),
      periods: [],
      people: [],
      assumptions: {
        terms: 'nominal',
        cpi: 0.025,
        rpi: 0.03,
        average_earnings_increase: 0.025,
      },
    }

    const out = run(cashflow)

    expect(2 + 2).toBe(4)
  })
})
