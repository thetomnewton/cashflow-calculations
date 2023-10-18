import { date } from '../lib/date'
import {
  Account,
  Cashflow,
  CashflowAssumptions,
  ISA,
  Income,
  MoneyPurchase,
  Person,
} from '../types'
import { v4 } from 'uuid'

type FactoryPerson = Partial<Person> & Pick<Person, 'sex'>
type FactoryCashflow = Partial<Omit<Cashflow, 'assumptions'>> &
  Pick<Cashflow, 'people'> & {
    assumptions?: Partial<CashflowAssumptions> | undefined
  }
type FactoryIncome = Partial<Income> & Pick<Income, 'people'>
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
    sex: params.sex,
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
    incomes: params.incomes ?? [],
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
    tax_category: params.tax_category,
  }
}

export function makeAccount(params: FactoryAccount) {
  return {
    id: params.id ?? v4(),
    is_sweep: params.is_sweep ?? false,
    category: params.category,
    sub_category: params.sub_category,
    owner_id: params.owner_id,
    valuations: params.valuations,
    growth_template: params.growth_template,
    contributions: params.contributions ?? [],
  }
}

export function makeMoneyPurchase(params: FactoryMoneyPurchase): MoneyPurchase {
  return {
    id: params.id ?? v4(),
    category: 'money_purchase',
    sub_category: params.sub_category,
    owner_id: params.owner_id,
    valuations: params.valuations,
    growth_template: params.growth_template,
    contributions: params.contributions ?? [],
  }
}

export function makeISA(params: FactoryISA) {
  return makeAccount({
    ...params,
    ...{ category: 'isa' },
  }) as ISA
}
