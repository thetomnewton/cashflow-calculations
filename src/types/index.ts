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

export interface Person {
  id: string
  date_of_birth: string
  tax_residency: 'eng' | 'sco' | 'ni' | 'wal'
  sex: 'male' | 'female'
  mpaa_triggered: boolean
  registered_blind: boolean
  lta_used: number
}

export interface EmploymentIncome {
  id: string
}

export interface Band {
  id: string
}

export interface Output {
  starts_at: string
  years: PlanningYear[]
  tax: {
    bands: {
      [taxYear: string]: {
        [personId: Person['id']]: {
          [bandId: Band['id']]: {}
        }
      }
    }
  }
  incomes: {
    [id: Income['id']]: {
      ad_hoc?: boolean
      year: {
        gross_value: number
        net_value: number
        tax: {
          tax_paid: number
          ni_paid: number
          bands: {
            [id: Band['id']]: {}
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
