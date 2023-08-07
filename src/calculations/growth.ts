export function applyGrowth(growth: number, inflation: number) {
  return Math.max(0, (1 + growth) / (1 + inflation))
}
