import { v4 } from 'uuid'
import { getValueInYear } from './entity'
import { getYearIndex } from './income-tax'
import { getRatesInTaxYear } from '../config/pensions'
import {
  BaseAccount,
  Cashflow,
  Contribution,
  Entity,
  Income,
  Output,
  Person,
  PlanningYear,
} from '../types'
import { isAccount, isMoneyPurchase } from './accounts'
import { ageAtDate } from './person'
import { date } from '../lib/date'
import { round } from 'lodash'

let cashflow: Cashflow
let output: Output
let year: PlanningYear
let yearIndex: number
let totalGrossPersonalContributions = 0

export function applyContributions(
  initYear: PlanningYear,
  initCashflow: Cashflow,
  initOutput: Output
) {
  year = initYear
  output = initOutput
  cashflow = initCashflow
  yearIndex = getYearIndex(year.tax_year, output)

  totalGrossPersonalContributions = 0

  cashflow.accounts.forEach(account => {
    const contributions = account.contributions ?? []

    contributions.forEach(contribution => {
      const value = getValueInYear(
        {
          type: 'contribution',
          id: v4(),
          people: [],
          values: [contribution],
        } as Entity,
        year,
        cashflow,
        output
      )

      const grossValue = addContributionToAccount(account, contribution, value)

      totalGrossPersonalContributions += grossValue

      if (contribution.type === 'personal')
        deductContributionFromSweepAccount(value)
    })
  })
}

function addContributionToAccount(
  account: BaseAccount,
  contribution: Contribution,
  value: number
) {
  const outputYear = output.accounts[account.id].years[yearIndex]

  const grossValue = calculateGrossContribution(account, contribution, value)

  if (typeof outputYear.current_value === 'undefined')
    outputYear.current_value = grossValue
  else outputYear.current_value += grossValue

  // todo: Track that the contribution happened
  return grossValue
}

function deductContributionFromSweepAccount(value: number) {
  const sweep = cashflow.accounts.find(acc => isAccount(acc) && acc.is_sweep)
  if (!sweep) throw new Error('Missing sweep account when making contribution')

  const outputYear = output.accounts[sweep.id].years[yearIndex]
  if (typeof outputYear.current_value === 'undefined')
    outputYear.current_value = -value
  else outputYear.current_value -= value
}

function calculateGrossContribution(
  account: BaseAccount,
  contribution: Contribution,
  baseValue: number
) {
  if (!isMoneyPurchase(account) || contribution.type !== 'personal')
    return baseValue

  // Only if the person is a relevant individual in the
  // current year, are they eligible for tax relief.

  if (!isRelevantIndividualThisTaxYear(account.owner_id as string))
    return baseValue

  // Get the tax relief rate.
  const rates = getRatesInTaxYear(year.tax_year)
  const taxReliefRate = rates.contribution_tax_relief_rate

  // todo: Convert to real terms if required
  const basicAmount = rates.contribution_tax_relief_basic_amount

  // Determine the max tax relief available, which is the larger of the person's
  // total relevant earnings this tax year and the basic amount.
  const maxTaxReliefAvailable = Math.max(
    basicAmount,
    totalRelevantEarnings(account.owner_id as string)
  )

  const remainingTaxRelievableGrossContributions = Math.max(
    0,
    maxTaxReliefAvailable - totalGrossPersonalContributions
  )

  const taxRelievableNetContribution = Math.min(
    baseValue,
    remainingTaxRelievableGrossContributions * (1 - taxReliefRate)
  )
  const nonTaxRelievableNetContribution =
    baseValue - taxRelievableNetContribution

  const grossContribution =
    taxRelievableNetContribution / (1 - taxReliefRate) +
    nonTaxRelievableNetContribution

  return round(grossContribution, 2)
}

function isRelevantIndividualThisTaxYear(personId: Person['id']) {
  const person = cashflow.people.find(({ id }) => id === personId)
  if (!person) throw new Error(`Account has missing owner`)

  const yearStartDate = date(cashflow.starts_at)
    .add(yearIndex, 'year')
    .toISOString()

  return (
    ageAtDate(person, yearStartDate) <
    getRatesInTaxYear(year.tax_year).relevant_individual_age_range_upper
  )
}

function totalRelevantEarnings(personId: Person['id']) {
  const person = cashflow.people.find(({ id }) => id === personId)
  if (!person) throw new Error(`Account has missing owner`)

  if (cashflow.incomes.length === 0) return 0

  let total = 0

  cashflow.incomes
    .filter(
      income => income.people.includes(person) && isRelevantIncome(income)
    )
    .forEach(income => {
      total += output.incomes[income.id].years[yearIndex].taxable_value
    })

  return total
}

function isRelevantIncome(income: Income) {
  return (
    income.type === 'employment' ||
    income.type === 'self_employment' ||
    (income.type === 'other' && income.tax_category === 'earned')
  )
}
