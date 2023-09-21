export interface Cashflow {
  id: string
  starts_at: string
  years: number
  people: Person[]
  assumptions: CashflowAssumptions
  incomes: Income[]
  accounts: Account[]
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

type OutputPersonValues = {
  in_drawdown: false
}

export interface Output {
  starts_at: string
  years: PlanningYear[]
  people: {
    [personId: Person['id']]: {
      start: OutputPersonValues
      end: OutputPersonValues
    }
  }
  tax: {
    bands: {
      [taxYear: string]: {
        [personId: Person['id']]: OutputTaxBand[]
      }
    }
  }
  incomes: {
    [id: Income['id']]: {
      years: OutputIncomeYear[]
    }
  }
  accounts: {
    [id: Account['id']]: {
      years: OutputAccountYear[]
    }
  }
}

export type PossibleNICs = 'class1' | 'class2' | 'class4'

export type OutputIncomeYear = {
  gross_value: number
  bonus?: number
  benefits?: number
  taxable_value: number
  net_value: number
  tax: {
    ni_paid: {
      [className: string]: number
    }
    bands: {
      [bandKey: Band['key']]: {
        used: number
        tax_paid: number
      }
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
  tax_category?: IncomeTaxTypes | 'non_taxable' // only applies when type is 'other'
}

export type IncomeTaxTypes = 'earned' | 'savings' | 'dividend'

interface Valuation {
  date: string
  value: number
}

export type GrowthTemplate = FlatGrowthTemplate | ArrayGrowthTemplate

interface FlatGrowthTemplate {
  type: 'flat'
  rate: GrowthRateEntry
}

interface ArrayGrowthTemplate {
  type: 'array'
  rate: GrowthRateEntry[]
}

type GrowthRateEntry = {
  gross_rate: number
  charges?: number
}

export interface Account {
  id: string
  category: string
  owner_id: Person['id']
  valuations: Valuation[]
  growth_template: GrowthTemplate
}

export interface MoneyPurchase extends Account {
  category: 'money_purchase'
}

interface OutputAccountYear {
  start_value: number
  end_value: number
  growth: number
}
