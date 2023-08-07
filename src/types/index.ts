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

export interface Output {
  starts_at: string
  years: PlanningYear[]
  tax: {
    bands: {
      [id: string]: {}
    }
  }
  incomes: {
    [id: Income['id']]: {
      ad_hoc?: boolean
      year: {
        value: number
        tax: {
          tax_paid: number
          ni_paid: number
          bands: {
            [id: string]: number
          }
        }
      }[]
    }
  }
}

interface IncomeValue {
  value: number
  starts_at: string
  ends_at: string
}

export interface Income {
  id: string
  people: Person[]
  values: IncomeValue[]
}
