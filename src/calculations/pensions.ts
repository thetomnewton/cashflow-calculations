import {
  ActiveDBPension,
  DeferredDBPension,
  DefinedBenefitPension,
  InPaymentDBPension,
} from '../types'

export function isDeferredDBPension(
  pension: DefinedBenefitPension
): pension is DeferredDBPension {
  return pension.status === 'deferred'
}

export function isActiveDBPension(
  pension: DefinedBenefitPension
): pension is ActiveDBPension {
  return pension.status === 'active'
}

export function isInPaymentDBPension(
  pension: DefinedBenefitPension
): pension is InPaymentDBPension {
  return pension.status === 'in_payment'
}
