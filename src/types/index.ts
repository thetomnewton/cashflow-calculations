export interface Cashflow {
  id: string
  starts_at: string
  years: number
  people: Person[]
  assumptions: CashflowAssumptions
  incomes: Income[]
}

export interface CashflowAssumptions {
  terms: 'real' | 'nominal'
  cpi: number
  rpi: number
  average_earnings_increase: number
}

export interface PlanningYear {
  starts_at: string
  ends_at: string
  tax_year: string
}

type PossibleCountries = 'eng' | 'sco' | 'ni' | 'wal'

export interface Person {
  id: string
  date_of_birth: string
  tax_residency: PossibleCountries
  sex: 'male' | 'female'
  mpaa_triggered: boolean
  registered_blind: boolean
  lta_used: number
}

export interface Band {
  key: string
  type: 'band' | 'allowance'
  extends_for_ras_contributions?: boolean
  regions: {
    earned: PossibleCountries[]
    savings: PossibleCountries[]
    dividend: PossibleCountries[]
  }
  rates: {
    earned: number
    savings: number
    dividend: number
  }
}

export interface PersonalAllowance extends Band {
  key: 'personal_allowance'
  taper_rate: number
  adjusted_net_income_limit: number
}

export interface OutputTaxBand {
  id: string
  key: Band['key']
  bound_lower: number
  bound_upper: number
  remaining: number
}

export interface Output {
  starts_at: string
  years: PlanningYear[]
  tax: {
    bands: {
      [taxYear: string]: {
        [personId: Person['id']]: OutputTaxBand[]
      }
    }
  }
  incomes: {
    [id: Income['id']]: {
      ad_hoc?: boolean
      years: OutputIncomeYear[]
    }
  }
}

export type OutputIncomeYear = {
  gross_value: number
  bonus?: number
  benefits?: number
  net_value: number
  tax: {
    tax_paid: number
    ni_paid: number
    bands: {
      [bandKey: Band['key']]: {}
    }
  }
}

export interface EntityValue {
  value: number
  starts_at: string
  ends_at: string
  escalation: number | 'cpi' | 'rpi'
  adjusted?: boolean
}

export interface Entity {
  type: string
  id: string
  people: Person[]
  values: EntityValue[]
}

export interface Income extends Entity {
  type:
    | 'employment'
    | 'self_employment'
    | 'dividend'
    | 'other'
    | 'pension'
    | 'savings'
}
