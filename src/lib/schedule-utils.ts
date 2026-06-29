/** Returns the Monday at or before the given date (UTC) */
function floorToMonday(d: Date): Date {
  const day = d.getUTCDay() // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day
  const result = new Date(d)
  result.setUTCDate(d.getUTCDate() + diff)
  result.setUTCHours(0, 0, 0, 0)
  return result
}

/** Array of Monday dates from the week containing start through the week containing end */
export function weeksInRange(start: Date, end: Date): Date[] {
  const weeks: Date[] = []
  const cursor = floorToMonday(start)
  const last = floorToMonday(end)
  while (cursor <= last) {
    weeks.push(new Date(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }
  return weeks
}

/** Format as "06 Jul" */
export function weekLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
}

/**
 * Given a phase and the gantt's first week (Monday), return
 * 0-based column index and column span for CSS grid placement.
 */
export function phaseWeeks(
  phase: { startDate: string; endDate: string },
  ganttStart: Date,
): { startCol: number; spanCols: number } {
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000
  const phaseStart = floorToMonday(new Date(phase.startDate))
  const phaseEnd = new Date(phase.endDate)
  const startCol = Math.max(0, Math.round((phaseStart.getTime() - ganttStart.getTime()) / MS_PER_WEEK))
  const spanCols = Math.max(1, Math.ceil((phaseEnd.getTime() - phaseStart.getTime()) / MS_PER_WEEK))
  return { startCol, spanCols }
}
