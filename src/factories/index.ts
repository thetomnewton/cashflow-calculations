import { v4 } from 'uuid'
import { date } from '../lib/date'
import {
  Account,
  Cashflow,
  CashflowAssumptions,
  Expense,
  ISA,
  Income,
  MoneyPurchase,
  Person,
} from '../types'

type FactoryPerson = Partial<Person>
type FactoryCashflow = Partial<Omit<Cashflow, 'assumptions'>> &
  Pick<Cashflow, 'people'> & {
    assumptions?: Partial<CashflowAssumptions> | undefined
  }
type FactoryIncome = Partial<Income> & Pick<Income, 'people'>
type FactoryExpense = Partial<Expense>
type FactoryAccount = Partial<Account> &
  Pick<Account, 'category' | 'owner_id' | 'valuations' | 'growth_template'>
type FactoryMoneyPurchase = Partial<MoneyPurchase> &
  Pick<MoneyPurchase, 'owner_id' | 'valuations' | 'growth_template'>
type FactoryISA = Partial<ISA> &
  Pick<ISA, 'owner_id' | 'valuations' | 'growth_template'>

const defaultAssumptions: Cashflow['assumptions'] = {
  terms: 'nominal',
  cpi: 0.025,
  rpi: 0.03,
  average_earnings_increase: 0.025,
}

export function makePerson(params: FactoryPerson): Person {
  return {
    id: params.id ?? v4(),
    date_of_birth:
      params.date_of_birth ?? date('1970-01-01 00:00:00').toISOString(),
    tax_residency: params.tax_residency ?? 'eng',
    sex: params.sex ?? Math.random() < 0.5 ? 'male' : 'female',
    in_drawdown: params.in_drawdown ?? false,
    registered_blind: params.registered_blind ?? false,
  }
}

export function makeCashflow(params: FactoryCashflow): Cashflow {
  return {
    id: params.id ?? v4(),
    starts_at: params.starts_at ?? date().startOf('day').toISOString(),
    years: params.years ?? 1,
    people: params.people,
    accounts: params.accounts ?? [],
    money_purchases: params.money_purchases ?? [],
    incomes: params.incomes ?? [],
    expenses: params.expenses ?? [],
    assumptions: params.assumptions
      ? { ...defaultAssumptions, ...params.assumptions }
      : defaultAssumptions,
  }
}

export function makeIncome(params: FactoryIncome): Income {
  return {
    id: params.id ?? v4(),
    people: params.people,
    values: params.values ?? [],
    type: params.type || 'employment',
    source_id: params.source_id || undefined,
  }
}

export function makeExpense(params: FactoryExpense): Expense {
  return {
    id: params.id ?? v4(),
    values: params.values ?? [],
  }
}

export function makeAccount(params: FactoryAccount) {
  return {
    id: params.id ?? v4(),
    section: 'accounts' as const,
    is_sweep: params.is_sweep ?? false,
    category: params.category,
    sub_category: params.sub_category,
    owner_id: params.owner_id,
    valuations: params.valuations,
    growth_template: params.growth_template,
    contributions: params.contributions ?? [],
    withdrawals: params.withdrawals ?? [],
  }
}

export function makeMoneyPurchase(params: FactoryMoneyPurchase): MoneyPurchase {
  return {
    id: params.id ?? v4(),
    section: 'money_purchases' as const,
    category: 'money_purchase',
    sub_category: params.sub_category,
    owner_id: params.owner_id,
    valuations: params.valuations,
    growth_template: params.growth_template,
    contributions: params.contributions ?? [],
    withdrawals: params.withdrawals ?? [],
  }
}

export function makeISA(params: FactoryISA) {
  return makeAccount({
    ...params,
    ...{ category: 'isa' },
  }) as ISA
}
