'use client'
import { useEffect, useState } from 'react'

type StockItem = { id: string; key: string; item: string; unit: string; inStock: number; reserved: number; threshold: number }

const DEFAULT_STOCK: StockItem[] = [
  { id: 'tube48', key: 'tube48', item: 'Tube 48.3mm (6m)', unit: 'No.', inStock: 500, reserved: 120, threshold: 100 },
  { id: 'board', key: 'board', item: 'Scaffold boards 225mm (3.9m)', unit: 'No.', inStock: 800, reserved: 240, threshold: 200 },
  { id: 'coupler-rac', key: 'coupler-rac', item: 'Right-angle coupler', unit: 'No.', inStock: 2000, reserved: 600, threshold: 500 },
  { id: 'coupler-swivel', key: 'coupler-swivel', item: 'Swivel coupler', unit: 'No.', inStock: 800, reserved: 200, threshold: 150 },
  { id: 'base', key: 'base', item: 'Base plates', unit: 'No.', inStock: 300, reserved: 60, threshold: 80 },
  { id: 'sole', key: 'sole', item: 'Sole boards', unit: 'No.', inStock: 300, reserved: 60, threshold: 80 },
  { id: 'tie', key: 'tie', item: 'Anchor ties', unit: 'No.', inStock: 400, reserved: 90, threshold: 100 },
]

export default function InventoryPanel() {
  const [stock, setStock] = useState<StockItem[]>(DEFAULT_STOCK)
  const [editing, setEditing] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/inventory')
      .then(r => r.json())
      .then(data => { if (!cancelled && Array.isArray(data)) setStock(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  function update(id: string, field: 'inStock' | 'reserved', value: number) {
    setStock(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
    setEditing(null)
    const item = stock.find(s => s.id === id)
    if (item) {
      fetch('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: item.key, [field]: value }),
      }).catch(() => {})
    }
  }

  const lowStock = stock.filter(s => (s.inStock - s.reserved) < s.threshold)

  function exportCsv() {
    const rows = [
      ['Item', 'Unit', 'In Stock', 'Reserved', 'Available', 'Threshold', 'Status'],
      ...stock.map(s => {
        const avail = s.inStock - s.reserved
        return [s.item, s.unit, String(s.inStock), String(s.reserved), String(avail), String(s.threshold), avail < s.threshold ? 'LOW' : 'OK']
      }),
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {lowStock.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          ⚠ Low stock: {lowStock.map(s => `${s.item} (${s.inStock - s.reserved} avail < ${s.threshold})`).join(', ')}
        </div>
      )}
      <div className="rounded border bg-card overflow-hidden">
        <div className="px-4 py-2 border-b bg-muted/20 flex justify-between items-center">
          <h3 className="text-sm font-semibold">Inventory — Yard Stock</h3>
          <button onClick={exportCsv} className="text-xs rounded bg-slate-800 text-white px-2 py-1 hover:bg-slate-700">Export CSV</button>
        </div>
        <table className="w-full text-xs">
          <thead><tr className="bg-muted/10 text-muted-foreground"><th className="text-left px-3 py-2">Item</th><th className="text-right px-3 py-2">In Stock</th><th className="text-right px-3 py-2">Reserved</th><th className="text-right px-3 py-2">Available</th><th className="px-3 py-2">Status</th></tr></thead>
          <tbody>
            {stock.map(s => {
              const avail = s.inStock - s.reserved
              const low = avail < s.threshold
              return (
                <tr key={s.id} className={`border-t ${low ? 'bg-amber-50' : ''}`}>
                  <td className="px-3 py-2">{s.item} <span className="text-muted-foreground">({s.unit})</span></td>
                  <td className="px-3 py-2 text-right">
                    {editing === `${s.id}-stock` ? (
                      <input autoFocus defaultValue={s.inStock} onBlur={e => update(s.id, 'inStock', parseInt(e.target.value)||0)} onKeyDown={e => e.key==='Enter' && update(s.id, 'inStock', parseInt((e.target as HTMLInputElement).value)||0)} className="w-16 rounded border px-1 py-0.5 text-right" />
                    ) : (
                      <button onClick={() => setEditing(`${s.id}-stock`)} className="hover:underline">{s.inStock}</button>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {editing === `${s.id}-res` ? (
                      <input autoFocus defaultValue={s.reserved} onBlur={e => update(s.id, 'reserved', parseInt(e.target.value)||0)} onKeyDown={e => e.key==='Enter' && update(s.id, 'reserved', parseInt((e.target as HTMLInputElement).value)||0)} className="w-16 rounded border px-1 py-0.5 text-right" />
                    ) : (
                      <button onClick={() => setEditing(`${s.id}-res`)} className="hover:underline">{s.reserved}</button>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${low?'text-amber-700':'text-green-700'}`}>{avail}</td>
                  <td className={`px-3 py-2 ${low?'text-amber-700':'text-green-700'}`}>{low?'⚠ Low':'✓ OK'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Click In Stock / Reserved to edit. Available = In Stock − Reserved. Threshold triggers low-stock warning. Data saved locally; integrate with ERP for live stock later.</p>
    </div>
  )
}
