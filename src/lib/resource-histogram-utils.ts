import type { GanttJob } from '@/components/schedule/gantt-chart'

export type WeeklyDemand = {
  weekStart: Date
  totalManhours: number
  byJob: Record<string, number>
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

function floorToMonday(d: Date): Date {
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const result = new Date(d)
  result.setUTCDate(d.getUTCDate() + diff)
  result.setUTCHours(0, 0, 0, 0)
  return result
}

export function computeWeeklyDemand(jobs: GanttJob[], weeks: Date[]): WeeklyDemand[] {
  return weeks.map((weekStart) => {
    const weekEnd = new Date(weekStart.getTime() + MS_PER_WEEK)
    const byJob: Record<string, number> = {}

    for (const job of jobs) {
      for (const struct of job.structures) {
        for (const phase of struct.phases) {
          const phaseStart = floorToMonday(new Date(phase.startDate))
          const phaseEnd = new Date(phase.endDate)
          if (phaseStart >= weekEnd || phaseEnd <= weekStart) continue
          const durationMs = Math.max(MS_PER_WEEK, phaseEnd.getTime() - phaseStart.getTime())
          const durationWeeks = Math.ceil(durationMs / MS_PER_WEEK)
          const weeklyShare = phase.manhoursTotal / durationWeeks
          byJob[job.jobId] = (byJob[job.jobId] ?? 0) + weeklyShare
        }
      }
    }

    const totalManhours = Object.values(byJob).reduce((s, v) => s + v, 0)
    return { weekStart, totalManhours, byJob }
  })
}
