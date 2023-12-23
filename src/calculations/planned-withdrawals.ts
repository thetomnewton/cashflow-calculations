import { round } from 'lodash'
import { v4 } from 'uuid'
import {
  Account,
  BaseAccount,
  Cashflow,
  Income,
  MoneyPurchase,
  MoneyPurchaseWithdrawal,
  Output,
  Person,
  PlanningYear,
} from '../types'
import { isAccount, isMoneyPurchase } from './accounts'
import { entityValueActive, getValueInYear } from './entity'
import { getYearIndex } from './income-tax'
import { getTaxableValue } from './incomes'
import { makeOutputIncomeObj } from './init'

let cashflow: Cashflow
let output: Output
let year: PlanningYear
let yearIndex: number

export function applyPlannedWithdrawals(
  baseYear: PlanningYear,
  baseCashflow: Cashflow,
  baseOutput: Output
) {
  year = baseYear
  cashflow = baseCashflow
  output = baseOutput
  yearIndex = getYearIndex(year.tax_year, output)

  const withdrawables = [...cashflow.accounts, ...cashflow.money_purchases]

  withdrawables.forEach(account => {
    const withdrawals = account.withdrawals ?? []

    // todo: sort withdrawals into appropriate order

    withdrawals.forEach(withdrawal => {
      if (!entityValueActive(year, withdrawal)) return

      const grossValue = getValueInYear(withdrawal, year, cashflow, output)
      if (grossValue <= 0) return

      if (isAccount(account)) {
        withdrawGrossValueFromAccount(account, grossValue)
      } else if (isMoneyPurchase(account)) {
        withdrawGrossValueFromMoneyPurchase(
          account,
          grossValue,
          (withdrawal as MoneyPurchaseWithdrawal).method
        )
      }
    })
  })
}

export function withdrawGrossValueFromAccount(
  account: Account,
  intendedValue: number,
  adHoc?: boolean
) {
  const outputYear = output.accounts[account.id].years[yearIndex]
  const currentAccountValue = outputYear.current_value ?? 0
  const actualWithdrawal = Math.max(
    0,
    Math.min(currentAccountValue, intendedValue)
  )

  outputYear.current_value = round(currentAccountValue - actualWithdrawal, 2)

  if (!adHoc) updateRelatedIncome(account, actualWithdrawal)
  else createAdhocIncome(account, actualWithdrawal)

  return { actualWithdrawal }
}

export function withdrawGrossValueFromMoneyPurchase(
  account: MoneyPurchase,
  intendedValue: number,
  method: MoneyPurchaseWithdrawal['method'],
  adHoc?: boolean
) {
  const outputYear = output.money_purchases[account.id].years[yearIndex]

  const currentValue = outputYear.current_value ?? 0
  const currentUncrystallised = outputYear.current_value_uncrystallised ?? 0
  const currentCrystallised = outputYear.current_value_crystallised ?? 0

  let actualWithdrawal, uncrystallisedWithdrawal, crystallisedWithdrawal: number

  if (method === 'ufpls') {
    crystallisedWithdrawal = 0
    uncrystallisedWithdrawal = Math.max(
      0,
      Math.min(currentUncrystallised, intendedValue)
    )
    actualWithdrawal = uncrystallisedWithdrawal
  } else if (method === 'pcls') {
    actualWithdrawal = Math.max(
      0,
      Math.min(currentUncrystallised / 4, intendedValue)
    )
    uncrystallisedWithdrawal = actualWithdrawal * 4
    crystallisedWithdrawal = actualWithdrawal * -3
  } else if (method === 'fad') {
    uncrystallisedWithdrawal = 0
    crystallisedWithdrawal = Math.max(
      0,
      Math.min(currentCrystallised, intendedValue)
    )
    actualWithdrawal = crystallisedWithdrawal
  } else {
    throw new Error('Invalid money purchase withdrawal method')
  }

  outputYear.current_value = round(currentValue - actualWithdrawal, 2)
  outputYear.current_value_uncrystallised = round(
    currentUncrystallised - uncrystallisedWithdrawal,
    2
  )
  outputYear.current_value_crystallised = round(
    currentCrystallised - crystallisedWithdrawal,
    2
  )

  if (!adHoc) updateRelatedIncome(account, actualWithdrawal)
  else createAdhocIncome(account, actualWithdrawal)

  return { actualWithdrawal, uncrystallisedWithdrawal, crystallisedWithdrawal }
}

function updateRelatedIncome(account: BaseAccount, amount: number) {
  const relatedIncome = cashflow.incomes.find(
    inc => inc.source_id === account.id && !inc.ad_hoc
  )

  if (!relatedIncome) throw new Error('Missing withdrawal income for account')

  const existingValue = relatedIncome.values.find(
    value =>
      value.starts_at === year.starts_at && value.ends_at === year.ends_at
  )

  if (!existingValue)
    relatedIncome.values.push({
      value: amount,
      escalation: 0,
      starts_at: year.starts_at,
      ends_at: year.ends_at,
    })
  else existingValue.value += amount

  const outputIncomeYear = output.incomes[relatedIncome.id].years[yearIndex]
  outputIncomeYear.gross_value += amount
  outputIncomeYear.taxable_value = getTaxableValue(
    relatedIncome,
    outputIncomeYear,
    cashflow
  )
}

function createAdhocIncome(account: BaseAccount, value: number) {
  /**
   * Add an ad-hoc withdrawal object to the account itself, then
   * create an ad-hoc income, then add the income to the output
   * object and set it's gross and taxable values for this year.
   */

  const id = v4()
  const newWithdrawal = {
    id,
    value,
    starts_at: year.starts_at,
    ends_at: year.ends_at,
    escalation: 0,
    ad_hoc: true,
  }

  if (isMoneyPurchase(account))
    account.withdrawals.push({ ...newWithdrawal, ...{ method: 'ufpls' } })
  else account.withdrawals.push(newWithdrawal)

  const personIds = Array.isArray(account.owner_id)
    ? account.owner_id
    : [account.owner_id]

  const people = personIds.map(id =>
    cashflow.people.find(p => p.id === id)
  ) as Person[]

  const adHocIncome: Income = {
    id: v4(),
    type: isMoneyPurchase(account) ? 'pension' : 'other_non_taxable',
    ad_hoc: true,
    people,
    source_id: account.id,
    source_withdrawal_id: id,
    values: [
      {
        value,
        starts_at: year.starts_at,
        ends_at: year.ends_at,
        escalation: 0,
      },
    ],
  }

  cashflow.incomes.push(adHocIncome)

  output.incomes[adHocIncome.id] = makeOutputIncomeObj(
    adHocIncome,
    cashflow,
    output
  )

  const outputIncomeYear = output.incomes[adHocIncome.id].years[yearIndex]
  outputIncomeYear.gross_value = value
  outputIncomeYear.taxable_value = getTaxableValue(
    adHocIncome,
    outputIncomeYear,
    cashflow
  )
}
