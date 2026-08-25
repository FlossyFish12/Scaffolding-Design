'use client'
import { useEffect, useState } from 'react'

export type CheckItem = { id: string; label: string; clause: string; checked: boolean; notes: string }

const DEFAULT_ITEMS: Omit<CheckItem, 'checked' | 'notes'>[] = [
  { id: 'base', label: 'Base plates & sole boards level, firm bearing', clause: 'TG20 7.2' },
  { id: 'stds', label: 'Standards plumb, couplers tight (6.1kN slip)', clause: 'EN74' },
  { id: 'ledgers', label: 'Ledgers at lift height (±50mm), 3 per lift', clause: 'TG20 B.1' },
  { id: 'transoms', label: 'Transoms @ ≤1.2m, boards fully supported', clause: 'EN12811' },
  { id: 'boards', label: 'Boards (225mm) no gaps >25mm, 50mm overhang', clause: 'EN12811 §5.14' },
  { id: 'ties', label: 'Ties per pattern (4m grid), tested 6kN', clause: 'TG20 8.3' },
  { id: 'guards', label: 'Guard rail 950mm + mid rail 470mm + toe board 150mm', clause: 'EN12811 §6.2.5' },
  { id: 'access', label: 'Safe access (ladder/stair) + hatch', clause: 'TG20 9.1' },
  { id: 'tag', label: 'Scaffold tag + loading notice displayed', clause: 'TG20 12.2' },
  { id: 'insp', label: 'Weekly inspection ≤7 days, after events', clause: 'EN5975 §8' },
]

function storageKey(zoneId?: string) {
  return zoneId ? `safety-checklist-${zoneId}` : 'safety-checklist-global'
}

export default function SafetyChecklist({ zoneId, title }: { zoneId?: string; title?: string }) {
  const [items, setItems] = useState<CheckItem[]>(() =>
    DEFAULT_ITEMS.map((d) => ({ ...d, checked: false, notes: '' }))
  )
  const [inspector, setInspector] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration from localStorage is intentional
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(zoneId))
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed.items)) setItems(parsed.items)
        if (parsed.inspector) setInspector(parsed.inspector)
        if (parsed.date) setDate(parsed.date)
      }
    } catch {}
  }, [zoneId])

  useEffect(() => {
    localStorage.setItem(storageKey(zoneId), JSON.stringify({ items, inspector, date }))
  }, [items, inspector, date, zoneId])

  const progress = items.filter((i) => i.checked).length
  const allChecked = progress === items.length

  function toggle(id: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, checked: !it.checked } : it)))
  }

  function exportCsv() {
    const rows = [
      ['Check', 'Clause', 'Pass', 'Notes', 'Inspector', 'Date'],
      ...items.map((i) => [i.label, i.clause, i.checked ? 'PASS' : 'FAIL', i.notes.replace(/,/g, ';'), inspector, date]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `checklist-${zoneId || 'global'}-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title || 'Safety Checklist'} — {progress}/{items.length} {allChecked ? '✓' : ''}</h3>
        <span className={`text-xs px-2 py-1 rounded ${allChecked ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
          {allChecked ? 'Ready for handover' : `${items.length - progress} remaining`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label>Inspector<input value={inspector} onChange={e => setInspector(e.target.value)} placeholder="Name" className="w-full mt-1 rounded border px-2 py-1" /></label>
        <label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full mt-1 rounded border px-2 py-1" /></label>
      </div>
      <div className="space-y-1 max-h-72 overflow-auto pr-1">
        {items.map((it) => (
          <label key={it.id} className={`flex items-start gap-2 rounded border p-2 ${it.checked ? 'bg-green-50 border-green-200' : 'bg-card'}`}>
            <input type="checkbox" checked={it.checked} onChange={() => toggle(it.id)} className="mt-0.5" />
            <div className="flex-1">
              <div className="text-xs font-medium">{it.label}</div>
              <div className="text-xs text-muted-foreground">{it.clause}</div>
              <input
                value={it.notes}
                onChange={e => setItems(prev => prev.map(p => p.id === it.id ? { ...p, notes: e.target.value } : p))}
                placeholder="Notes"
                className="w-full mt-1 rounded border px-2 py-1 text-xs"
              />
            </div>
            <span className={`text-xs ${it.checked ? 'text-green-700' : 'text-amber-700'}`}>{it.checked ? '✓' : '○'}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={exportCsv} className="rounded bg-slate-800 text-white px-3 py-1.5 text-xs hover:bg-slate-700">
          Export CSV
        </button>
        <button
          onClick={() => {
            if (confirm('Reset checklist?')) setItems(DEFAULT_ITEMS.map(d => ({ ...d, checked: false, notes: '' })))
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
