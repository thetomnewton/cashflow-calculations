import dayjs from 'dayjs'
import { run } from '../src/calculations'
import { makeCashflow, makePerson } from '../src/factories'

describe('basic tests', () => {
  test('can create a cashflow', () => {
    const cashflow = makeCashflow({
      people: [makePerson({ legal_sex: 'male' })],
    })

    const out = run(cashflow)

    expect(out.starts_at).toBe(dayjs().startOf('day').toISOString())
    expect(out.ends_at).toBe(
      dayjs().startOf('day').add(1, 'year').toISOString()
    )
  })
})
