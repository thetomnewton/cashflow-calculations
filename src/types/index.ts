export interface Cashflow {
  id: string
  starts_at: string
  years: number
  people: Person[]
  assumptions: CashflowAssumptions
  incomes: Income[]
  expenses: Expense[]
  accounts: Account[]
  money_purchases: MoneyPurchase[]
  defined_benefits: DefinedBenefitPension[]
}

export interface CashflowAssumptions {
  terms: 'real' | 'nominal'
  cpi: number
  rpi: number
  average_earnings_increase: number
  windfall_save: 'discard' | 'sweep'
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
  in_drawdown: boolean
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
  bound_upper_original?: number
}

type OutputPersonValues = {
  in_drawdown: boolean
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
  expenses: {
    [id: Expense['id']]: {
      years: OutputExpenseYear[]
    }
  }
  accounts: {
    [id: Account['id']]: {
      years: OutputAccountYear[]
    }
  }
  money_purchases: {
    [id: MoneyPurchase['id']]: {
      years: OutputMoneyPurchaseYear[]
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

export type OutputExpenseYear = {
  value: number
}

export interface EntityValue {
  value: number
  starts_at: string
  ends_at: string
  escalation: number | 'cpi' | 'rpi'
  adjusted?: boolean

  bonus?: number
  benefits?: number
}

export interface Entity {
  type: string
  id: string
  people: Person[]
  values: EntityValue[]
}

export interface Income extends Entity {
  ad_hoc?: boolean
  source_id?: BaseAccount['id']
  source_withdrawal_id?: Withdrawal['id']
  type:
    | 'employment'
    | 'self_employment'
    | 'dividend'
    | 'other_taxable'
    | 'other_non_taxable'
    | 'pension'
    | 'savings'
}

export interface Expense extends Entity {}

export interface EmploymentIncome extends Income {
  type: 'employment'
}

export interface SelfEmploymentIncome extends Income {
  type: 'self_employment'
}

export interface DividendIncome extends Income {
  type: 'dividend'
}

export interface OtherTaxableIncome extends Income {
  type: 'other_taxable'
}

export interface OtherNonTaxableIncome extends Income {
  type: 'other_non_taxable'
}

export type IncomeTaxTypes = 'earned' | 'savings' | 'dividend'

export interface Valuation {
  date: string
  value: number
}

export interface MoneyPurchaseValuation extends Valuation {
  uncrystallised_value: number
  crystallised_value: number
}

export type GrowthTemplate = FlatGrowthTemplate | ArrayGrowthTemplate

export interface FlatGrowthTemplate {
  type: 'flat'
  rate: GrowthRateEntry
}

export interface ArrayGrowthTemplate {
  type: 'array'
  rate: GrowthRateEntry[]
}

type GrowthRateEntry = {
  gross_rate: number
  charges?: number
}

export interface BaseAccount {
  id: string
  section: 'accounts' | 'money_purchases'
  category: string
  sub_category?: string
  owner_id: Person['id'] | Person['id'][]
  growth_template: GrowthTemplate
  contributions: Contribution[]
  withdrawals: Withdrawal[]
}

export interface Account extends BaseAccount {
  section: 'accounts'
  valuations: Valuation[]
  is_sweep?: boolean
}

export interface Contribution extends EntityValue {
  type: 'personal' | 'employer'
}

export interface Withdrawal extends EntityValue {
  id: string
  ad_hoc?: boolean
}
export interface MoneyPurchaseWithdrawal extends Withdrawal {
  method: 'ufpls' | 'fad' | 'pcls'
}

export interface MoneyPurchase extends BaseAccount {
  section: 'money_purchases'
  category: 'money_purchase'
  valuations: MoneyPurchaseValuation[]
  withdrawals: MoneyPurchaseWithdrawal[]
}

export interface ISA extends Account {
  category: 'isa'
  sub_category: 'cash_isa' | 'stocks_shares_isa' | 'lifetime_isa' | 'junior_isa'
}

interface OutputAccountYear {
  start_value: number | undefined
  current_value: number | undefined
  end_value: number | undefined
  net_growth: number | undefined
}

export interface OutputMoneyPurchaseYear extends OutputAccountYear {
  start_value_crystallised: number | undefined
  start_value_uncrystallised: number | undefined
  current_value_crystallised: number | undefined
  current_value_uncrystallised: number | undefined
  end_value_crystallised: number | undefined
  end_value_uncrystallised: number | undefined
}

export interface DefinedBenefitPension {
  id: string
  status: 'active' | 'deferred' | 'in_payment'
  active_escalation_rate: number | 'cpi' | 'rpi'
  starts_at: string
}

export interface ActiveDBPension extends DefinedBenefitPension {
  linked_salary_id: Income['id']
  accrual_rate: string // 1/60, 1/80 etc.
  deferment_escalation_rate: number | 'cpi' | 'rpi'
}

export interface DeferredDBPension extends DefinedBenefitPension {
  status: 'deferred'
  annual_amount: number
  deferment_escalation_rate: number | 'cpi' | 'rpi'
  normal_retirement_age: number
}
