// 事業年度の開始月から12ヶ月分のyear_monthを返す
// fiscalYear: 事業年度の開始年（例：3月始まりの2025年度 = 2025-03〜2026-02）
export function getFiscalYearMonths(fiscalYear: number, startMonth: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const totalMonth = (startMonth - 1 + i)
    const year = fiscalYear + Math.floor(totalMonth / 12)
    const month = (totalMonth % 12) + 1
    return `${year}-${String(month).padStart(2, '0')}`
  })
}

// 今日の日付から現在の事業年度（開始年）を返す
export function getCurrentFiscalYear(startMonth: number): number {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return month >= startMonth ? year : year - 1
}
