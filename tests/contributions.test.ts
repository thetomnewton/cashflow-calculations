import { makeAccount, makePerson } from '../src/factories'
import { iso } from '../src/lib/date'

describe('contributions', () => {
  test('can make a personal contribution to a cash account', () => {
    const person = makePerson({ date_of_birth: '1985-01-01', sex: 'female' })

    const cash1 = makeAccount({
      category: 'cash',
      owner_id: person.id,
      valuations: [{ date: iso(), value: 1000 }],
      growth_template: { type: 'flat', rate: { gross_rate: 0.05, charges: 0 } },
      contributions: [
        {
          type: 'personal',
          value: 1000,
          starts_at: iso(),
          ends_at: iso('2025-04-06'),
          escalation: 'cpi',
        },
      ],
    })

    // expect the 1000 to be added to cash1 in year 0
    // expect 1000 to be drawn from the sweep account
    // expect the person to be overdrawn
  })
})
