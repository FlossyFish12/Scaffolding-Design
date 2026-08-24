'use client'
import { useMemo, useState } from 'react'
import { computeWeeklyDemand } from '@/lib/resource-histogram-utils'
import type { GanttJob } from '@/components/schedule/gantt-chart'

type PoolEntry = { id: string; weekStartDate: string; availableManhours: number }

export default function CrewCalendar({ jobs, weeks, initialPool }: { jobs: GanttJob[]; weeks: Date[]; initialPool: PoolEntry[] }) {
  const [pool, setPool] = useState<Map<string, number>>(() => {
    const m = new Map<string, number>()
    for (const e of initialPool) m.set(new Date(e.weekStartDate).toISOString().slice(0,10), e.availableManhours)
    return m
  })
  const [editingWeek, setEditingWeek] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const demand = useMemo(() => computeWeeklyDemand(jobs, weeks), [jobs, weeks])

  const rows = weeks.map((w, i) => {
    const key = w.toISOString().slice(0,10)
    const cap = pool.get(key) ?? 400 // default 40 crew *10hrs*? Actually 400 hrs/week default
    const dem = demand[i]?.totalManhours ?? 0
    const variance = cap - dem
    const overloaded = dem > cap
    return { week: w, key, cap, dem, variance, overloaded }
  })

  const overloadedWeeks = rows.filter(r => r.overloaded)

  async function saveCapacity(key: string, value: string) {
    const cap = parseFloat(value)
    if (isNaN(cap) || cap < 0) return
    setPool(prev => { const m = new Map(prev); m.set(key, cap); return m })
    setEditingWeek(null)
    // persist via API
    try {
      await fetch('/api/resource-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStartDate: key, availableManhours: cap }),
      })
    } catch {}
  }

  return (
    <div className="space-y-4">
      {overloadedWeeks.length > 0 && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          ⚠ {overloadedWeeks.length} overloaded week(s): {overloadedWeeks.map(r => r.week.toLocaleDateString()).join(', ')} — consider adding crew or shifting phases in Gantt
        </div>
      )}
      <div className="rounded border bg-card overflow-hidden">
        <div className="px-4 py-2 border-b bg-muted/20 flex justify-between items-center">
          <h3 className="text-sm font-semibold">Crew Calendar — Weekly Demand vs Capacity</h3>
          <span className="text-xs text-muted-foreground">Default 400 hrs/wk ≈ 10 crew × 40h · Click capacity to edit</span>
        </div>
        <table className="w-full text-xs">
          <thead><tr className="bg-muted/10 text-muted-foreground"><th className="text-left px-3 py-2">Week</th><th className="text-right px-3 py-2">Demand (hrs)</th><th className="text-right px-3 py-2">Capacity (hrs)</th><th className="text-right px-3 py-2">Variance</th><th className="px-3 py-2">Status</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} className={`border-t ${r.overloaded ? 'bg-red-50' : ''}`}>
                <td className="px-3 py-2">{r.week.toLocaleDateString()} — {new Date(r.week.getTime()+6*86400000).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-right">{r.dem.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">
                  {editingWeek === r.key ? (
                    <input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)} onBlur={()=>saveCapacity(r.key, editValue)} onKeyDown={e=>e.key==='Enter'&&saveCapacity(r.key, editValue)} className="w-20 rounded border px-1 py-0.5 text-right" />
                  ) : (
                    <button onClick={()=>{setEditingWeek(r.key); setEditValue(String(r.cap))}} className="hover:underline">{r.cap}</button>
                  )}
                </td>
                <td className={`px-3 py-2 text-right ${r.variance<0?'text-red-700':'text-green-700'}`}>{r.variance.toFixed(1)}</td>
                <td className={`px-3 py-2 ${r.overloaded?'text-red-700 font-medium':'text-green-700'}`}>{r.overloaded?'⚠ Overloaded':'✓ OK'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Shifts: 10 crew × 8h = 80 hrs/day, 5 days = 400 hrs/wk. Adjust capacity per week for leave, overtime, or extra gangs.</p>
    </div>
  )
}
