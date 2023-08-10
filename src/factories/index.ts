import { date } from '../lib/date'
import { Cashflow, CashflowAssumptions, Income, Person } from '../types'
import { v4 } from 'uuid'

type FactoryPerson = Partial<Person> & Pick<Person, 'sex'>
type FactoryCashflow = Partial<Omit<Cashflow, 'assumptions'>> &
  Pick<Cashflow, 'people'> & {
    assumptions?: Partial<CashflowAssumptions> | undefined
  }
type FactoryIncome = Partial<Income> & Pick<Income, 'people'>

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
    mpaa_triggered: params.mpaa_triggered ?? false,
    registered_blind: params.registered_blind ?? false,
  }
}

export function makeCashflow(params: FactoryCashflow): Cashflow {
  return {
    id: params.id ?? v4(),
    starts_at: params.starts_at ?? date().startOf('day').toISOString(),
    years: params.years ?? 1,
    people: params.people,
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
  }
}
