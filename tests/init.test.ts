import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { run } from '../src/calculations'
import { makeCashflow, makePerson } from '../src/factories'

dayjs.extend(utc)

describe('initialisation tests', () => {
  test('can create a cashflow', () => {
    const cashflow = makeCashflow({
      people: [makePerson({ legal_sex: 'male' })],
    })

    const out = run(cashflow)

    expect(out.starts_at).toBe(dayjs.utc().startOf('day').toISOString())
    expect(out.ends_at).toBe(
      dayjs.utc().startOf('day').add(1, 'year').toISOString()
    )
  })

  test('can set cashflow params', () => {
    const startDate = dayjs.utc('2023-04-06').toISOString()
    const cashflow = makeCashflow({
      people: [makePerson({ legal_sex: 'male' })],
      starts_at: startDate,
    })

    expect(cashflow.starts_at).toBe(startDate)
  })
})
