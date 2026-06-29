'use client'
import { useState } from 'react'
import { weekLabel } from '@/lib/schedule-utils'
import { computeWeeklyDemand, type WeeklyDemand } from '@/lib/resource-histogram-utils'
import type { GanttJob } from './gantt-chart'

type ResourcePoolEntry = {
  id: string
  weekStartDate: string
  availableManhours: number
}

type Props = {
  jobs: GanttJob[]
  weeks: Date[]
  initialPool: ResourcePoolEntry[]
}

// Consistent job colours derived from index
const JOB_COLORS = ['#00B451', '#1A2F44', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444']

export default function ResourceHistogram({ jobs, weeks, initialPool }: Props): React.JSX.Element {
  const [pool, setPool] = useState<Map<number, number>>(() => {
    const m = new Map<number, number>()
    for (const entry of initialPool) {
      m.set(new Date(entry.weekStartDate).getTime(), entry.availableManhours)
    }
    return m
  })
  const [saving, setSaving] = useState<number | null>(null)

  const demand: WeeklyDemand[] = computeWeeklyDemand(jobs, weeks)
  const maxValue = Math.max(
    ...demand.map(d => d.totalManhours),
    ...[...pool.values()],
    1,
  )
  const BAR_MAX_H = 160 // px

  const jobColorMap: Record<string, string> = {}
  jobs.forEach((j, i) => { jobColorMap[j.jobId] = JOB_COLORS[i % JOB_COLORS.length] })

  async function saveCapacity(weekStart: Date, value: string) {
    const manhours = parseFloat(value)
    if (isNaN(manhours) || manhours < 0) return
    const key = weekStart.getTime()
    setSaving(key)
    try {
      const res = await fetch('/api/resource-pool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStartDate: weekStart.toISOString(), availableManhours: manhours }),
      })
      if (!res.ok) return
      setPool(prev => new Map(prev).set(key, manhours))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="p-6 space-y-6" style={{ background: 'var(--background)' }}>
      <div className="flex items-center gap-6 flex-wrap">
        {jobs.map((j, i) => (
          <div key={j.jobId} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: JOB_COLORS[i % JOB_COLORS.length] }}
            />
            {j.projectNumber} {j.title}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block w-8 border-t-2 border-dashed" style={{ borderColor: '#E53E3E' }} />
          Capacity
        </div>
      </div>

      {/* Histogram */}
      <div className="flex items-end gap-1 overflow-x-auto pb-2">
        {weeks.map((weekStart, wi) => {
          const d = demand[wi] ?? { totalManhours: 0, byJob: {} }
          const capacity = pool.get(weekStart.getTime()) ?? 0
          const totalH = Math.round((d.totalManhours / maxValue) * BAR_MAX_H)
          const capH = Math.round((capacity / maxValue) * BAR_MAX_H)
          const overloaded = capacity > 0 && d.totalManhours > capacity

          let stackOffset = 0
          return (
            <div key={wi} className="flex flex-col items-center gap-1" style={{ minWidth: 48 }}>
              <div
                className="relative w-8"
                style={{ height: BAR_MAX_H, display: 'flex', alignItems: 'flex-end' }}
              >
                {/* Stacked demand bars */}
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t overflow-hidden"
                  style={{ height: totalH, background: overloaded ? '#FEE2E2' : 'transparent' }}
                >
                  {jobs.map((job) => {
                    const hrs = d.byJob[job.jobId] ?? 0
                    const h = Math.round((hrs / maxValue) * BAR_MAX_H)
                    const bottom = stackOffset
                    stackOffset += h
                    return (
                      <div
                        key={job.jobId}
                        className="absolute left-0 right-0"
                        style={{
                          bottom,
                          height: h,
                          background: jobColorMap[job.jobId],
                        }}
                        title={`${job.projectNumber}: ${hrs.toFixed(0)} hrs`}
                      />
                    )
                  })}
                </div>
                {/* Capacity line */}
                {capacity > 0 && (
                  <div
                    className="absolute left-0 right-0"
                    style={{
                      bottom: capH,
                      borderTop: '2px dashed #E53E3E',
                    }}
                  />
                )}
              </div>
              <span className="text-xs text-muted-foreground" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 36 }}>
                {weekLabel(weekStart)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Capacity editor table */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Weekly Crew Capacity (manhours)</h2>
        <div className="overflow-x-auto">
          <table className="text-sm w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Week</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Demand</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Capacity</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((weekStart, wi) => {
                const d = demand[wi] ?? { totalManhours: 0, byJob: {} }
                const capacity = pool.get(weekStart.getTime()) ?? 0
                const overloaded = capacity > 0 && d.totalManhours > capacity
                const key = weekStart.getTime()
                return (
                  <tr key={wi} className={`border-t border-border/50 ${overloaded ? 'bg-red-50' : ''}`}>
                    <td className="px-3 py-1.5">{weekLabel(weekStart)}</td>
                    <td className="px-3 py-1.5 text-right">{d.totalManhours.toFixed(0)}</td>
                    <td className="px-3 py-1.5 text-right">
                      <input
                        type="number"
                        step="10"
                        min="0"
                        defaultValue={capacity || ''}
                        placeholder="0"
                        onBlur={(e) => saveCapacity(weekStart, e.target.value)}
                        disabled={saving === key}
                        aria-label={`Capacity for week of ${weekLabel(weekStart)}`}
                        className="w-20 text-right border border-border rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs font-medium">
                      {capacity === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : overloaded ? (
                        <span style={{ color: '#E53E3E' }}>Overloaded</span>
                      ) : (
                        <span style={{ color: 'var(--green)' }}>OK</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
