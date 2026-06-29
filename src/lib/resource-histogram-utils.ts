import type { GanttJob } from '@/components/schedule/gantt-chart'

export type WeeklyDemand = {
  weekStart: Date
  totalManhours: number
  byJob: Record<string, number>  // jobId → manhours
}

export function computeWeeklyDemand(jobs: GanttJob[], weeks: Date[]): WeeklyDemand[] {
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

  return weeks.map((weekStart) => {
    const weekEnd = new Date(weekStart.getTime() + MS_PER_WEEK)
    const byJob: Record<string, number> = {}

    for (const job of jobs) {
      for (const struct of job.structures) {
        for (const phase of struct.phases) {
          const phaseStart = new Date(phase.startDate)
          const phaseEnd = new Date(phase.endDate)
          // Check overlap: phase overlaps this week
          if (phaseStart >= weekEnd || phaseEnd <= weekStart) continue
          // Duration in weeks (even distribution) — use ceil so a 13-day phase counts as 2 weeks
          const durationMs = phaseEnd.getTime() - phaseStart.getTime()
          const durationWeeks = Math.max(1, Math.ceil(durationMs / MS_PER_WEEK))
          const weeklyShare = phase.manhoursTotal / durationWeeks
          byJob[job.jobId] = (byJob[job.jobId] ?? 0) + weeklyShare
        }
      }
    }

    const totalManhours = Object.values(byJob).reduce((s, v) => s + v, 0)
    return { weekStart, totalManhours, byJob }
  })
}
