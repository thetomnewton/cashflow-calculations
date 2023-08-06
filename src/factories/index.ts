import dayjs from 'dayjs'
import { Cashflow, Person } from '../types'
import { v4 as uuid } from 'uuid'

type FactoryPerson = Partial<Person> & Pick<Person, 'legal_sex'>
type FactoryCashflow = Partial<Cashflow> & Pick<Cashflow, 'people'>

const defaultAssumptions: Cashflow['assumptions'] = {
  terms: 'nominal',
  cpi: 0.025,
  rpi: 0.03,
  average_earnings_increase: 0.025,
}

export function makePerson(params: FactoryPerson): Person {
  return {
    id: params.id ?? uuid(),
    date_of_birth: params.date_of_birth ?? dayjs('1970-01-01').toISOString(),
    tax_residency: params.tax_residency ?? 'uk',
    legal_sex: params.legal_sex,
    mpaa_triggered: params.mpaa_triggered ?? false,
    registered_blind: params.registered_blind ?? false,
    lta_used: params.lta_used ?? 0,
  }
}

export function makeCashflow(params: FactoryCashflow): Cashflow {
  return {
    id: params.id ?? uuid(),
    starts_at: params.starts_at ?? dayjs().toISOString(),
    ends_at: params.starts_at ?? dayjs().add(1, 'year').toISOString(),
    people: params.people,
    assumptions: params.assumptions
      ? { ...params.assumptions, ...defaultAssumptions }
      : defaultAssumptions,
  }
}
