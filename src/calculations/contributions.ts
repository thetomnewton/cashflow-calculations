import { v4 } from 'uuid'
import { getValueInYear } from './entity'
import { getYearIndex } from './income-tax'
import { getRatesInTaxYear, knownRates } from '../config/pensions'
import {
  BaseAccount,
  Cashflow,
  Contribution,
  Entity,
  Output,
  Person,
  PlanningYear,
} from '../types'
import { isAccount, isMoneyPurchase } from './accounts'
import { ageAtDate } from './person'
import { date } from '../lib/date'

let cashflow: Cashflow
let output: Output
let year: PlanningYear
let yearIndex: number

export function applyContributions(
  initYear: PlanningYear,
  initCashflow: Cashflow,
  initOutput: Output
) {
  year = initYear
  output = initOutput
  cashflow = initCashflow
  yearIndex = getYearIndex(year.tax_year, output)

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

      addContributionToAccount(account, contribution, value)

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
  if (isMoneyPurchase(account) && contribution.type === 'personal') {
    // If the person is a relevant individual in the current year,
    // they are eligible for tax relief.

    if (!isRelevantIndividualThisTaxYear(account.owner_id as string))
      return baseValue

    // Get the tax relief rate.
    const rates = getRatesInTaxYear(year.tax_year)
    const taxReliefRate = rates.contribution_tax_relief_rate

    // todo: Convert to real terms if required
    const basicAmount = rates.contribution_tax_relief_basic_amount

    // todo:
    // Determine the max tax relief available, which is the larger of the person's
    // total relevant earnings this tax year and the basic amount.
  }

  return baseValue
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
