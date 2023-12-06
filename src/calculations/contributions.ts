import { round } from 'lodash'
import { getRatesInTaxYear } from '../config/pensions'
import { date } from '../lib/date'
import {
  BaseAccount,
  Cashflow,
  Contribution,
  Income,
  Output,
  Person,
  PlanningYear,
} from '../types'
import { isAccount, isMoneyPurchase } from './accounts'
import { getValueInYear } from './entity'
import { applyGrowth } from './growth'
import { getYearIndex } from './income-tax'
import { isEmployment, isOtherTaxableIncome, isSelfEmployment } from './incomes'
import { ageAtDate } from './person'

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
      const value = getValueInYear(contribution, year, cashflow, output)

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
  else
    outputYear.current_value = round(grossValue + outputYear.current_value, 2)

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
  if (!contributionCanGetTaxRelief(account, contribution)) return baseValue

  // Only if the person is a relevant individual in the
  // current year, are they eligible for tax relief.
  if (!isRelevantIndividualThisTaxYear(account.owner_id as string))
    return baseValue

  // Get the tax relief rate.
  const rates = getRatesInTaxYear(year.tax_year)
  const taxReliefRate = rates.contribution_tax_relief_rate

  // Convert to real terms if required
  let basicAmount = rates.contribution_tax_relief_basic_amount
  if (cashflow.assumptions.terms === 'real') {
    basicAmount = round(
      basicAmount * applyGrowth(0, cashflow.assumptions.cpi) ** yearIndex,
      2
    )
  }

  // Determine the max tax relief available, which is the larger of the person's
  // total relevant earnings this tax year and the basic amount.
  const maxTaxReliefAvailable = Math.max(
    basicAmount,
    totalRelevantEarnings(account.owner_id as string)
  )

  // Deduct the gross contributions that have already been made from
  // the remaining tax relievable portion of gross contributions.
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
    .filter(inc => inc.people.includes(person) && isRelevantIncome(inc))
    .forEach(inc => {
      total += output.incomes[inc.id].years[yearIndex].taxable_value
    })

  return total
}

/**
 * Relevant income includes things like employment income and self-employment income.
 * It does not include dividends, pension income or most rental income.
 */
function isRelevantIncome(income: Income) {
  return (
    isEmployment(income) ||
    isSelfEmployment(income) ||
    isOtherTaxableIncome(income)
  )
}

function contributionCanGetTaxRelief(
  account: BaseAccount,
  contribution: Contribution
) {
  return isMoneyPurchase(account) && contribution.type === 'personal'
}
