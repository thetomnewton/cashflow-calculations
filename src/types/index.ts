import { z } from 'zod';

export const personSchema = z.object({
  id: z.string(),
  date_of_birth: z.string(),
  tax_residency: z.enum(['eng', 'wal', 'sco', 'ni']),
  sex: z.enum(['male', 'female']),
  in_drawdown: z.boolean(),
  registered_blind: z.boolean(),
});

export type Person = z.infer<typeof personSchema>;

export const cashflowAssumptionsSchema = z.object({
  terms: z.enum(['real', 'nominal']),
  cpi: z.number().min(0).max(1),
  rpi: z.number().min(0).max(1),
  average_earnings_increase: z.number().min(0).max(1),
  windfall_save: z.enum(['discard', 'sweep']),
  liquidation_strategy: z.enum(['taxation', 'custom']),
  custom_liquidation_order: z.array(z.string()).optional(),
});

export type CashflowAssumptions = z.infer<typeof cashflowAssumptionsSchema>;

export const incomeSchema = z.object({
  id: z.string(),
  type: z.enum([
    'employment',
    'self_employment',
    'dividend',
    'other_taxable',
    'other_non_taxable',
    'pension',
    'savings',
  ]),
  people: z.array(personSchema),
  values: z.array(
    z.object({
      value: z.number(),
      bonus: z.optional(z.number().min(0)),
      benefits: z.optional(z.number().min(0)),
      adjusted: z.optional(z.boolean()),
      starts_at: z.string().datetime(),
      ends_at: z.string().datetime(),
      escalation: z.enum(['cpi', 'rpi']).or(z.number().min(-1).max(1)),
    })
  ),
  ad_hoc: z.optional(z.boolean()),
  source_id: z.optional(z.string()),
  source_withdrawal_id: z.optional(z.string()),
});

export type Income = z.infer<typeof incomeSchema>;

export const expenseSchema = z.object({
  type: z.string(),
  id: z.string(),
  people: z.array(personSchema),
  values: z.array(
    z.object({
      value: z.number(),
      starts_at: z.string().datetime(),
      ends_at: z.string().datetime(),
      escalation: z.enum(['cpi', 'rpi']).or(z.number().min(-1).max(1)),
      adjusted: z.optional(z.boolean()),
    })
  ),
});

export type Expense = z.infer<typeof expenseSchema>;

export const contributionSchema = z.object({
  person_id: z.string(),
  value: z.number().min(0),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  escalation: z.enum(['cpi', 'rpi']).or(z.number().min(-1).max(1)),
  adjusted: z.optional(z.boolean()),
  type: z.enum(['personal', 'employer']),
});

export type Contribution = z.infer<typeof contributionSchema>;

export const withdrawalSchema = z.object({
  id: z.string(),
  value: z.number().min(0),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  escalation: z.enum(['cpi', 'rpi']).or(z.number().min(-1).max(1)),
  adjusted: z.optional(z.boolean()),
  ad_hoc: z.optional(z.boolean()),
});

export type Withdrawal = z.infer<typeof withdrawalSchema>;

export const moneyPurchasewithdrawalSchema = withdrawalSchema.extend({
  method: z.enum(['ufpls', 'fad', 'pcls']),
});

export const valuationSchema = z.object({
  date: z.string().datetime(),
  value: z.number(),
});

export type Valuation = z.infer<typeof valuationSchema>;

const GrowthRateEntrySchema = z.object({
  gross_rate: z.number().min(-1).max(1),
  charges: z.optional(z.number().min(-1).max(1)),
});

export const growthTemplateSchema = z
  .object({
    type: z.literal('flat'),
    rate: GrowthRateEntrySchema,
  })
  .or(
    z.object({
      type: z.literal('array'),
      rate: z.array(GrowthRateEntrySchema),
    })
  );

export type GrowthTemplate = z.infer<typeof growthTemplateSchema>;

export const accountSchema = z.object({
  id: z.string(),
  category: z.enum(['cash', 'isa', 'unwrapped', 'bond']),
  sub_category: z.optional(z.string()),
  owner_id: z.string().or(z.array(z.string())),
  section: z.literal('accounts'),
  is_sweep: z.optional(z.boolean()),
  contributions: z.array(contributionSchema),
  withdrawals: z.array(withdrawalSchema),
  valuations: z.array(valuationSchema),
  growth_template: growthTemplateSchema,
});

export type Account = z.infer<typeof accountSchema>;

const moneyPurchaseValuationSchema = z.object({
  date: z.string().datetime(),
  value: z.number().min(0),
  uncrystallised_value: z.number(),
  crystallised_value: z.number(),
});

export type MoneyPurchaseValuation = z.infer<
  typeof moneyPurchaseValuationSchema
>;

export const moneyPurchaseSchema = z.object({
  id: z.string(),
  category: z.literal('money_purchase'),
  sub_category: z.optional(z.string()),
  owner_id: z.string().or(z.array(z.string())),
  section: z.literal('money_purchases'),
  contributions: z.array(contributionSchema),
  growth_template: growthTemplateSchema,
  valuations: z.array(moneyPurchaseValuationSchema),
  withdrawals: z.array(moneyPurchasewithdrawalSchema),
});

export type MoneyPurchase = z.infer<typeof moneyPurchaseSchema>;

export const definedBenefitSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  status: z.enum(['active', 'deferred', 'in_payment']),
  active_escalation_rate: z.enum(['cpi', 'rpi']).or(z.number().min(-1).max(1)),
  starts_at: z.string().datetime(),
});

export type DefinedBenefitPension = z.infer<typeof definedBenefitSchema>;

export const cashflowSchema = z.object({
  id: z.string(),
  starts_at: z.string().datetime(),
  years: z.number().min(1).max(100),
  people: z.array(personSchema),
  assumptions: cashflowAssumptionsSchema,
  incomes: z.array(incomeSchema),
  expenses: z.array(expenseSchema),
  accounts: z.array(accountSchema),
  money_purchases: z.array(moneyPurchaseSchema),
  defined_benefits: z.array(definedBenefitSchema),
});

export type Cashflow = z.infer<typeof cashflowSchema>;

const planningYearSchema = z.object({
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  tax_year: z.string(),
});

export type PlanningYear = z.infer<typeof planningYearSchema>;

const possCountrySchema = z.enum(['eng', 'sco', 'ni', 'wal']);
type PossibleCountries = z.infer<typeof possCountrySchema>;

export interface Band {
  key: string;
  type: 'band' | 'allowance';
  extends_for_ras_contributions?: boolean;
  regions: {
    earned: PossibleCountries[];
    savings: PossibleCountries[];
    dividend: PossibleCountries[];
  };
  rates: {
    earned: number;
    savings: number;
    dividend: number;
  };
}

export interface PersonalAllowance extends Band {
  key: 'personal_allowance';
  taper_rate: number;
  adjusted_net_income_limit: number;
}

export interface OutputTaxBand {
  id: string;
  key: Band['key'];
  bound_lower: number;
  bound_upper: number;
  remaining: number;
  bound_upper_original?: number;
}

type OutputPersonValues = {
  in_drawdown: boolean;
};

export interface Output {
  starts_at: string;
  years: PlanningYear[];
  people: {
    [personId: Person['id']]: {
      start: OutputPersonValues;
      end: OutputPersonValues;
    };
  };
  tax: {
    bands: {
      [taxYear: string]: {
        [personId: Person['id']]: OutputTaxBand[];
      };
    };
  };
  incomes: {
    [id: Income['id']]: {
      years: OutputIncomeYear[];
    };
  };
  expenses: {
    [id: Expense['id']]: {
      years: OutputExpenseYear[];
    };
  };
  accounts: {
    [id: Account['id']]: {
      years: OutputAccountYear[];
    };
  };
  money_purchases: {
    [id: MoneyPurchase['id']]: {
      years: OutputMoneyPurchaseYear[];
    };
  };
}

export type PossibleNICs = 'class1' | 'class2' | 'class4';

export type OutputIncomeYear = {
  gross_value: number;
  bonus?: number;
  benefits?: number;
  taxable_value: number;
  net_value: number;
  tax: {
    ni_paid: {
      [className: string]: number;
    };
    bands: {
      [bandKey: Band['key']]: {
        used: number;
        tax_paid: number;
      };
    };
  };
};

export type OutputExpenseYear = {
  value: number;
};

export interface EntityValue {
  value: number;
  starts_at: string;
  ends_at: string;
  escalation: number | 'cpi' | 'rpi';
  adjusted?: boolean;

  bonus?: number;
  benefits?: number;
}

export interface Entity {
  type: string;
  id: string;
  people: Person[];
  values: EntityValue[];
}

export interface EmploymentIncome extends Income {
  type: 'employment';
}

export interface SelfEmploymentIncome extends Income {
  type: 'self_employment';
}

export interface DividendIncome extends Income {
  type: 'dividend';
}

export interface OtherTaxableIncome extends Income {
  type: 'other_taxable';
}

export interface OtherNonTaxableIncome extends Income {
  type: 'other_non_taxable';
}

export type IncomeTaxTypes = 'earned' | 'savings' | 'dividend';

export type BaseAccount = Account | MoneyPurchase;

export interface MoneyPurchaseWithdrawal extends Withdrawal {
  method: 'ufpls' | 'fad' | 'pcls';
}

export interface ISA extends Account {
  category: 'isa';
  sub_category:
    | 'cash_isa'
    | 'stocks_shares_isa'
    | 'lifetime_isa'
    | 'junior_isa';
}

export interface UnwrappedAccount extends Account {
  category: 'unwrapped';
  sub_category: 'gia' | 'unit_trust' | 'oeic' | 'shares' | 'trust' | 'crypto';
}

export interface GIA extends UnwrappedAccount {
  sub_category: 'gia';
}

export interface CashAccount extends Account {
  category: 'cash';
}

export interface Bond extends Account {
  category: 'bond';
}

interface OutputAccountYear {
  start_value: number | undefined;
  current_value: number | undefined;
  end_value: number | undefined;
  net_growth: number | undefined;
}

export interface OutputMoneyPurchaseYear extends OutputAccountYear {
  start_value_crystallised: number | undefined;
  start_value_uncrystallised: number | undefined;
  current_value_crystallised: number | undefined;
  current_value_uncrystallised: number | undefined;
  end_value_crystallised: number | undefined;
  end_value_uncrystallised: number | undefined;
}

export interface ActiveDBPension extends DefinedBenefitPension {
  status: 'active';
  linked_salary_id: Income['id'];
  accrual_rate: number; // 1/60, 1/80 etc.
  deferment_escalation_rate: number | 'cpi' | 'rpi';
  normal_retirement_age: number;
  actuarial_reduction_rate?: number;
  years_service: number;
}

export interface DeferredDBPension extends DefinedBenefitPension {
  status: 'deferred';
  annual_amount: number;
  deferment_escalation_rate: number | 'cpi' | 'rpi';
  normal_retirement_age: number;
  actuarial_reduction_rate?: number;
}

export interface InPaymentDBPension extends DefinedBenefitPension {
  status: 'in_payment';
  annual_amount: number;
}
