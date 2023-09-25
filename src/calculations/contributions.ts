import { v4 } from 'uuid'
import { getValueInYear } from './entity'
import { getYearIndex } from './income-tax'
import {
  BaseAccount,
  Cashflow,
  Contribution,
  Entity,
  Output,
  PlanningYear,
} from '../types'
import { isAccount, isMoneyPurchase } from './accounts'

let cashflow: Cashflow
let output: Output
let yearIndex: number

export function applyContributions(
  year: PlanningYear,
  initCashflow: Cashflow,
  initOutput: Output
) {
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
    // todo
    // If the person is a relevant individual in the current year,
    // they are eligible for tax relief.
    // Get the tax relief rate.
    // Determine the max tax relief available, which is the larger of the person's
    //   total relevant earnings this tax year and the contribution tax relief basic amount.
  }

  return baseValue
}
