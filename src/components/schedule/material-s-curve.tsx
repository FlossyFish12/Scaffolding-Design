'use client'
import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area } from 'recharts'

type ZoneMaterial = {
  zoneId: string
  label: string
  structureId: string
  quantityTubeM: number
  erectStart: string // ISO date
  dismantleEnd: string // ISO date
  actualQuantityTubeM?: number
  actualErectStart?: string
  actualDismantleEnd?: string
}

type Props = {
  zones: ZoneMaterial[]
}

function toWeekKey(d: Date) {
  const mon = new Date(d)
  mon.setHours(0,0,0,0)
  const day = mon.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday
  mon.setDate(mon.getDate() + diff)
  return mon.toISOString().slice(0,10)
}

function addWeeks(date: Date, weeks: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + weeks * 7)
  return d
}

export default function MaterialSCurve({ zones }: Props) {
  const [useActual, setUseActual] = useState(false)
  const [actuals, setActuals] = useState<Record<string, { qty?: number; erect?: string; dismantle?: string }>>({})

  // Build weekly buckets from min erect to max dismantle
  const { chartData, freeDates } = useMemo(() => {
    if (zones.length === 0) return { chartData: [], freeDates: [] as { zone: string; freeDate: string; qty: number }[] }

    const getQty = (z: ZoneMaterial) => {
      if (useActual && actuals[z.zoneId]?.qty !== undefined) return actuals[z.zoneId].qty!
      if (useActual && z.actualQuantityTubeM !== undefined) return z.actualQuantityTubeM
      return z.quantityTubeM
    }
    const getErect = (z: ZoneMaterial) => {
      if (useActual && actuals[z.zoneId]?.erect) return new Date(actuals[z.zoneId].erect!)
      if (useActual && z.actualErectStart) return new Date(z.actualErectStart)
      return new Date(z.erectStart)
    }
    const getDismantle = (z: ZoneMaterial) => {
      if (useActual && actuals[z.zoneId]?.dismantle) return new Date(actuals[z.zoneId].dismantle!)
      if (useActual && z.actualDismantleEnd) return new Date(z.actualDismantleEnd)
      return new Date(z.dismantleEnd)
    }

    const allDates = zones.flatMap(z => [getErect(z), getDismantle(z)])
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())))
    const weeks: Date[] = []
    let cur = new Date(toWeekKey(minDate))
    const end = new Date(toWeekKey(maxDate))
    end.setDate(end.getDate() + 7)
    while (cur <= end) {
      weeks.push(new Date(cur))
      cur = addWeeks(cur, 1)
    }

    const data = weeks.map(w => {
      const weekStart = w
      const weekEnd = addWeeks(w, 1)
      let inUse = 0
      let cumulative = 0
      for (const z of zones) {
        const erect = getErect(z)
        const dismantle = getDismantle(z)
        const qty = getQty(z)
        // If week overlaps [erect, dismantle), material is in use
        if (weekStart < dismantle && weekEnd > erect) {
          inUse += qty
        }
        // Cumulative erected up to this week (S-curve)
        if (erect <= weekEnd) cumulative += qty
      }
      return {
        week: w.toISOString().slice(0,10),
        inUse: Math.round(inUse),
        cumulative: Math.round(cumulative),
        free: 0, // will be computed as cumulative - inUse later? Actually free = total erected - inUse
      }
    })

    // Compute free as total erected that has been dismantled
    const totalPerZone = zones.reduce((sum, z) => sum + getQty(z), 0)
    const freeData = data.map((d, i) => {
      const erectedUpTo = d.cumulative
      const free = erectedUpTo - d.inUse
      return { ...d, free: Math.round(free) }
    })

    const frees = zones.map(z => ({
      zone: z.label,
      freeDate: getDismantle(z).toISOString().slice(0,10),
      qty: getQty(z),
    }))

    return { chartData: freeData, freeDates: frees }
  }, [zones, useActual, actuals])

  if (zones.length === 0) {
    return <div className="text-xs text-muted-foreground border rounded p-4">No zones with material to plot — create zones and set phase dates first.</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Material S-Curve — when material frees</h3>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={useActual} onChange={e => setUseActual(e.target.checked)} />
          Use actuals (input later)
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Tube (lm) in-use per week (step) + cumulative erected (S) + freed (cumulative − in-use). Toggle actuals after site counts/dates.
      </p>
      <div className="rounded border bg-card p-2" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="cumulative" name="Cumulative erected (S)" stroke="#16a34a" dot={false} strokeWidth={2} />
            <Line type="stepAfter" dataKey="inUse" name="In-use (on hire)" stroke="#2563eb" dot={false} strokeWidth={2} />
            <Area type="monotone" dataKey="free" name="Freed (available)" stroke="#94a3b8" fill="#f1f5f9" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded border bg-card p-2">
        <p className="text-xs font-semibold mb-1">Free dates per zone ({useActual ? 'actual' : 'estimated'})</p>
        <table className="w-full text-xs">
          <thead><tr className="text-muted-foreground"><th className="text-left">Zone</th><th className="text-right">Qty (lm)</th><th className="text-right">Free date</th><th className="text-right">Input actual</th></tr></thead>
          <tbody>
            {freeDates.map(f => (
              <tr key={f.zone} className="border-t">
                <td className="py-1">{f.zone}</td>
                <td className="py-1 text-right">{f.qty}</td>
                <td className="py-1 text-right">{f.freeDate}</td>
                <td className="py-1 text-right">
                  {useActual && (
                    <input
                      placeholder="qty"
                      defaultValue={actuals[zones.find(z=>z.label===f.zone)?.zoneId || '']?.qty ?? ''}
                      onBlur={e => {
                        const zone = zones.find(z=>z.label===f.zone)
                        if (!zone) return
                        const val = e.target.value ? parseFloat(e.target.value) : undefined
                        setActuals(prev => ({ ...prev, [zone.zoneId]: { ...prev[zone.zoneId], qty: val } }))
                      }}
                      className="w-16 rounded border px-1 py-0.5 text-right"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {useActual && <p className="text-xs text-muted-foreground mt-1">Enter actual tube meters after count — chart updates. Dates also editable per zone in Schedule (phase actual dates).</p>}
      </div>
    </div>
  )
}
