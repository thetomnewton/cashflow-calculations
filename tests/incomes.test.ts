import { describe, expect, test } from 'vitest';
import { v4 } from 'uuid';
import { incomeIsTaxable } from '../src/calculations/incomes';
import { makeCashflow, makeMoneyPurchase, makePerson } from '../src/factories';
import { iso } from '../src/lib/date';
import { Income, InPaymentDBPension } from '../src/types';

// helper to build a pension income tied to a withdrawal
function buildPensionIncome(personId: string, sourceId: string, withdrawalId: string): Income {
  return {
    id: v4(),
    type: 'pension',
    people: [makePerson({ id: personId })],
    values: [
      {
        value: 1000,
        starts_at: iso('2025-04-06'),
        ends_at: iso('2025-04-06'),
        escalation: 0,
      },
    ],
    source_id: sourceId,
    source_withdrawal_id: withdrawalId,
  };
}

describe('incomeIsTaxable', () => {
  test('returns false for pcls withdrawals', () => {
    const person = makePerson({});
    const withdrawalId = v4();
    const pension = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          date: iso('2025-04-06'),
          value: 10000,
          uncrystallised_value: 10000,
          crystallised_value: 0,
        },
      ],
      growth_template: { type: 'flat', rate: { gross_rate: 0, charges: 0 } },
      withdrawals: [
        {
          id: withdrawalId,
          value: 1000,
          starts_at: iso('2025-04-06'),
          ends_at: iso('2025-04-06'),
          escalation: 0,
          method: 'pcls',
        },
      ],
    });

    const income = buildPensionIncome(person.id, pension.id, withdrawalId);

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2025-04-06'),
      years: 1,
      money_purchases: [pension],
      incomes: [income],
    });

    expect(incomeIsTaxable(income, cashflow)).toBe(false);
  });

  test('returns true for fad withdrawals', () => {
    const person = makePerson({});
    const withdrawalId = v4();
    const pension = makeMoneyPurchase({
      owner_id: person.id,
      valuations: [
        {
          date: iso('2025-04-06'),
          value: 10000,
          uncrystallised_value: 10000,
          crystallised_value: 0,
        },
      ],
      growth_template: { type: 'flat', rate: { gross_rate: 0, charges: 0 } },
      withdrawals: [
        {
          id: withdrawalId,
          value: 1000,
          starts_at: iso('2025-04-06'),
          ends_at: iso('2025-04-06'),
          escalation: 0,
          method: 'fad',
        },
      ],
    });

    const income = buildPensionIncome(person.id, pension.id, withdrawalId);

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2025-04-06'),
      years: 1,
      money_purchases: [pension],
      incomes: [income],
    });

    expect(incomeIsTaxable(income, cashflow)).toBe(true);
  });

  test('returns true for defined benefit income', () => {
    const person = makePerson({});
    const dbPension: InPaymentDBPension = {
      id: v4(),
      owner_id: person.id,
      status: 'in_payment',
      annual_amount: 1000,
      active_escalation_rate: 0,
      starts_at: iso('2025-04-06'),
    };

    const income: Income = {
      id: v4(),
      people: [person],
      type: 'pension',
      values: [
        {
          value: 1000,
          starts_at: iso('2025-04-06'),
          ends_at: iso('2025-04-06'),
          escalation: 0,
        },
      ],
      source_id: dbPension.id,
    };

    const cashflow = makeCashflow({
      people: [person],
      starts_at: iso('2025-04-06'),
      years: 1,
      defined_benefits: [dbPension],
      incomes: [income],
    });

    expect(incomeIsTaxable(income, cashflow)).toBe(true);
  });
});
