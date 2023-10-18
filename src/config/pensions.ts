type KnownRatesType = {
  [key: string]: {
    contribution_tax_relief_rate: number
    contribution_tax_relief_basic_amount: number
    relevant_individual_age_range_upper: number
  }
}

export const knownRates: KnownRatesType = {
  2223: {
    contribution_tax_relief_rate: 0.2,
    contribution_tax_relief_basic_amount: 3600,
    relevant_individual_age_range_upper: 75,
  },
  2324: {
    contribution_tax_relief_rate: 0.2,
    contribution_tax_relief_basic_amount: 3600,
    relevant_individual_age_range_upper: 75,
  },
}

export function getRatesInTaxYear(taxYear: string) {
  // If the known rates are not available, use the most recent rates

  return (
    knownRates[taxYear] ||
    Object.entries(knownRates).sort((a, b) => +b[0] - +a[0])[0][1]
  )
}
