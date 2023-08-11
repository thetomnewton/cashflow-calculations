const eligibleIncomeTypes = ['employment', 'self_employment'] as const

/**
 * LEL: 123/week or 533/month
 * PT: 242/week or 1048/month
 * UEL: 967/week or 4189/month
 * lower profits limit: 12570/year
 *
 * class 1:
 * 12% between PT and UEL
 * 2% above UEL
 *
 * class 2:
 * self employed people making profits of 12570/year or more (lower profits limit)
 * 3.15/week for every relevant week (163.80/year)
 *
 * class 4:
 * taxable profits:
 * first 12570: 0%
 * from 12570-50270:9%
 * over 50270: 2%
 */
