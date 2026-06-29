'use client'
import { useState } from 'react'

type EstimateItem = {
  id: string
  category: 'material' | 'labour'
  description: string
  quantity: number
  unit: string
  unitManhours: number
  overridden: boolean
  zoneId: string
  drawingId: string
  jobId: string
}

type ZoneEstimate = {
  id: string
  label: string
  scaffoldType: string
  items: EstimateItem[]
}

type StructureEstimate = {
  structureId: string
  structureName: string
  drawingId: string
  zones: ZoneEstimate[]
}

type Props = {
  jobId: string
  title: string
  structures: StructureEstimate[]
}

const OVERRIDE_BG = 'bg-amber-50'

export default function EstimateSheet({ jobId, title, structures }: Props): React.JSX.Element {
  const [items, setItems] = useState<Map<string, EstimateItem>>(() => {
    const map = new Map<string, EstimateItem>()
    for (const s of structures) {
      for (const z of s.zones) {
        for (const item of z.items) {
          map.set(item.id, { ...item, jobId, drawingId: s.drawingId, zoneId: z.id })
        }
      }
    }
    return map
  })

  async function handleBlur(itemId: string, field: 'quantity' | 'unitManhours', value: string) {
    const parsed = parseFloat(value)
    if (isNaN(parsed) || parsed < 0) return
    const item = items.get(itemId)
    if (!item || item[field] === parsed) return

    try {
      const res = await fetch(
        `/api/jobs/${item.jobId}/drawings/${item.drawingId}/zones/${item.zoneId}/estimate-items/${itemId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: parsed }),
        },
      )
      if (!res.ok) return
      const updated: EstimateItem = await res.json()
      setItems((prev) => {
        const next = new Map(prev)
        next.set(itemId, { ...item, ...updated })
        return next
      })
    } catch {
      // silently ignore — the user sees no change
    }
  }

  function totalManhours(zoneItems: EstimateItem[]): number {
    return zoneItems
      .filter((i) => i.category === 'labour')
      .reduce((sum, i) => {
        const item = items.get(i.id) ?? i
        return sum + item.quantity * item.unitManhours
      }, 0)
  }

  const CELL = 'px-3 py-2 text-sm'
  const HEADER_CELL = 'px-3 py-2 text-xs font-medium text-muted-foreground text-left'
  const INPUT_CLASS =
    'w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-[var(--ring)] rounded text-sm text-right'

  return (
    <div className="p-6 space-y-8 overflow-auto h-full" style={{ background: 'var(--background)' }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Estimate — {title}</h1>
      </div>

      {structures.length === 0 && (
        <p className="text-muted-foreground text-sm">No estimate items yet. Generate estimates from the Drawing Editor.</p>
      )}

      {structures.map((structure) => {
        const structureManhours = structure.zones.flatMap((z) => z.items).reduce((sum, i) => {
          const item = items.get(i.id) ?? i
          return i.category === 'labour' ? sum + item.quantity * item.unitManhours : sum
        }, 0)

        return (
          <div key={structure.structureId} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--navy)' }}>
                {structure.structureName}{' '}
                <span className="text-sm font-normal text-muted-foreground">({structure.structureId})</span>
              </h2>
              <span className="text-sm font-medium">
                {structureManhours.toFixed(1)} total manhours
              </span>
            </div>

            {structure.zones.map((zone) => {
              const zoneItems = zone.items.map((i) => items.get(i.id) ?? i)
              const labourItems = zoneItems.filter((i) => i.category === 'labour')
              const materialItems = zoneItems.filter((i) => i.category === 'material')
              const zoneManhours = totalManhours(zone.items)

              return (
                <div key={zone.id} className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
                    <span className="text-sm font-medium">{zone.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {zone.scaffoldType} · {zoneManhours.toFixed(1)} hrs
                    </span>
                  </div>

                  {zoneItems.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">No estimate items. Click Generate Estimate in the Drawing Editor.</p>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className={HEADER_CELL} style={{ width: '40%' }}>Description</th>
                          <th className={`${HEADER_CELL} text-right`}>Qty</th>
                          <th className={HEADER_CELL}>Unit</th>
                          <th className={`${HEADER_CELL} text-right`}>Manhours/unit</th>
                          <th className={`${HEADER_CELL} text-right`}>Total hrs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {labourItems.length > 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-1 text-xs font-medium text-muted-foreground bg-muted/30">
                              Labour
                            </td>
                          </tr>
                        )}
                        {labourItems.map((item) => (
                          <tr
                            key={item.id}
                            className={`border-t border-border/50 ${item.overridden ? OVERRIDE_BG : ''}`}
                          >
                            <td className={CELL}>{item.description}</td>
                            <td className={`${CELL} text-right`}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={item.quantity}
                                onBlur={(e) => handleBlur(item.id, 'quantity', e.target.value)}
                                className={INPUT_CLASS}
                                aria-label={`Quantity for ${item.description}`}
                              />
                            </td>
                            <td className={CELL}>{item.unit}</td>
                            <td className={`${CELL} text-right`}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={item.unitManhours}
                                onBlur={(e) => handleBlur(item.id, 'unitManhours', e.target.value)}
                                className={INPUT_CLASS}
                                aria-label={`Manhours per unit for ${item.description}`}
                              />
                            </td>
                            <td className={`${CELL} text-right font-medium`}>
                              {(item.quantity * item.unitManhours).toFixed(2)}
                            </td>
                          </tr>
                        ))}

                        {materialItems.length > 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-1 text-xs font-medium text-muted-foreground bg-muted/30">
                              Materials
                            </td>
                          </tr>
                        )}
                        {materialItems.map((item) => (
                          <tr
                            key={item.id}
                            className={`border-t border-border/50 ${item.overridden ? OVERRIDE_BG : ''}`}
                          >
                            <td className={CELL}>{item.description}</td>
                            <td className={`${CELL} text-right`}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={item.quantity}
                                onBlur={(e) => handleBlur(item.id, 'quantity', e.target.value)}
                                className={INPUT_CLASS}
                                aria-label={`Quantity for ${item.description}`}
                              />
                            </td>
                            <td className={CELL}>{item.unit}</td>
                            <td className={`${CELL} text-right text-muted-foreground`}>—</td>
                            <td className={`${CELL} text-right text-muted-foreground`}>—</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
