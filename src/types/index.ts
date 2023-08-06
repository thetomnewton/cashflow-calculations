export interface Cashflow {
  id: string
  starts_at: string
  ends_at: string
  people: Person[]
  assumptions: CashflowAssumptions
}

export interface CashflowAssumptions {
  terms: 'real' | 'nominal'
  cpi: number
  rpi: number
  average_earnings_increase: number
}

export interface Period {
  id: string
  starts_at: string
  ends_at: string
}

export interface Person {
  id: string
  date_of_birth: string
  tax_residency: string
  sex: 'male' | 'female'
  mpaa_triggered: boolean
  registered_blind: boolean
  lta_used: number
}

export interface EmploymentIncome {
  id: string
}

export interface CashflowOutput {
  starts_at: string
  ends_at: string
  periods: Period[]
}
