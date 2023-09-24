import { v4 } from 'uuid'
import { Account, Cashflow, Entity, Output, PlanningYear } from '../types'
import { getValueInYear } from './entity'
import { getYearIndex } from './income-tax'

let output: Output
let cashflow: Cashflow
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

      addContributionToAccount(account, value)

      if (contribution.type === 'personal')
        deductContributionFromSweepAccount(value)
    })
  })
}

function addContributionToAccount(account: Account, value: number) {
  const outputYear = output.accounts[account.id].years[yearIndex]

  // todo: If contribution to DC pension then use gross up logic

  if (typeof outputYear.current_value === 'undefined')
    outputYear.current_value = value
  else outputYear.current_value += value

  // todo: track that the contribution happened
}

function deductContributionFromSweepAccount(value: number) {
  const sweep = cashflow.accounts.find(acc => acc.is_sweep)
  if (!sweep) throw new Error('Missing sweep account when making contribution')

  const outputYear = output.accounts[sweep.id].years[yearIndex]
  if (typeof outputYear.current_value === 'undefined')
    outputYear.current_value = -value
  else outputYear.current_value -= value
}
