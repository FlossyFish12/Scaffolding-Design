'use client'
import { useState } from 'react'

type ZoneActuals = {
  zoneId: string
  label: string
  structureName: string
  estimatedQty: number // tube lm from MTO
  actualQty: number | null
  plannedStart: string
  plannedEnd: string
  actualStart: string | null
  actualEnd: string | null
}

export default function ActualsForm({ zones, jobId }: { zones: ZoneActuals[]; jobId: string }) {
  const [rows, setRows] = useState(zones)
  const [saving, setSaving] = useState<string | null>(null)

  async function saveZone(row: ZoneActuals) {
    setSaving(row.zoneId)
    const [drawingId, zid] = row.zoneId.split(':')
    try {
      const res = await fetch(`/api/jobs/${jobId}/drawings/${drawingId}/zones/${zid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualQty: row.actualQty,
          actualStart: row.actualStart ? new Date(row.actualStart).toISOString() : null,
          actualEnd: row.actualEnd ? new Date(row.actualEnd).toISOString() : null,
        }),
      })
      if (!res.ok) throw new Error()
    } catch {}
    setSaving(null)
  }

  function update(zoneId: string, field: keyof ZoneActuals, value: string) {
    setRows(prev => prev.map(r => r.zoneId === zoneId ? { ...r, [field]: value === '' ? null : value } as ZoneActuals : r))
  }

  if (rows.length === 0) return null

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Site Actuals</h3>
        <p className="text-xs text-muted-foreground">Enter real quantities and dates after erection/dismantle. Variance feeds template tuning.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="text-left py-1 pr-2">Zone</th>
              <th className="text-right py-1 px-2">Est (lm)</th>
              <th className="text-right py-1 px-2">Actual</th>
              <th className="text-right py-1 px-2">Var %</th>
              <th className="text-left py-1 px-2">Plan window</th>
              <th className="text-left py-1 px-2">Actual start</th>
              <th className="text-left py-1 px-2">Actual end</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const variance = r.actualQty != null && r.estimatedQty > 0
                ? Math.round(((r.actualQty - r.estimatedQty) / r.estimatedQty) * 100)
                : null
              return (
                <tr key={r.zoneId} className="border-t">
                  <td className="py-1.5 pr-2">{r.structureName} — {r.label}</td>
                  <td className="py-1.5 px-2 text-right">{r.estimatedQty}</td>
                  <td className="py-1.5 px-2">
                    <input type="number" step="0.1" defaultValue={r.actualQty ?? ''} onBlur={e => update(r.zoneId, 'actualQty', e.target.value)} className="w-16 rounded border px-1 py-0.5 text-right" aria-label={`Actual quantity for ${r.label}`} />
                  </td>
                  <td className={`py-1.5 px-2 text-right font-medium ${variance == null ? 'text-muted' : variance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {variance == null ? '—' : `${variance > 0 ? '+' : ''}${variance}%`}
                  </td>
                  <td className="py-1.5 px-2 text-muted-foreground">
                    {new Date(r.plannedStart).toLocaleDateString()} → {new Date(r.plannedEnd).toLocaleDateString()}
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="date" defaultValue={r.actualStart ?? ''} onChange={e => update(r.zoneId, 'actualStart', e.target.value)} className="rounded border px-1 py-0.5" aria-label={`Actual start for ${r.label}`} />
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="date" defaultValue={r.actualEnd ?? ''} onChange={e => update(r.zoneId, 'actualEnd', e.target.value)} className="rounded border px-1 py-0.5" aria-label={`Actual end for ${r.label}`} />
                  </td>
                  <td className="py-1.5">
                    <button onClick={() => saveZone(rows.find(x => x.zoneId === r.zoneId)!)} disabled={saving === r.zoneId} className="rounded bg-slate-800 text-white px-2 py-1 hover:bg-slate-700 disabled:opacity-50">
                      {saving === r.zoneId ? '…' : 'Save'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Green variance = used less than estimated. Red = overrun. Saved to DB — visible to all users.</p>
    </div>
  )
}
