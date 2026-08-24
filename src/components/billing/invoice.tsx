'use client'
import { useMemo, useState } from 'react'

type LabourLine = { description: string; quantity: number; unitManhours: number; structure: string; zone: string }

export default function Invoice({ lines, jobRef }: { lines: LabourLine[]; jobRef: string }) {
  const [rate, setRate] = useState(45)
  const [vatPct, setVatPct] = useState(5)
  const [discountPct, setDiscountPct] = useState(0)

  const totals = useMemo(() => {
    const subtotalHrs = lines.reduce((s, l) => s + l.quantity * l.unitManhours, 0)
    const subtotalAed = subtotalHrs * rate
    const discountAed = subtotalAed * (discountPct / 100)
    const taxable = subtotalAed - discountAed
    const vatAed = taxable * (vatPct / 100)
    const grand = taxable + vatAed
    return { subtotalHrs, subtotalAed, discountAed, vatAed, grand }
  }, [lines, rate, vatPct, discountPct])

  function exportCsv() {
    const rows = [
      ['Invoice', jobRef, new Date().toISOString().slice(0,10)],
      ['Structure', 'Zone', 'Description', 'Qty', 'MH/unit', 'Total MH', `AED @${rate}/hr`],
      ...lines.map(l => {
        const hrs = l.quantity * l.unitManhours
        return [l.structure, l.zone, l.description, String(l.quantity), String(l.unitManhours), hrs.toFixed(2), (hrs*rate).toFixed(2)]
      }),
      [], ['Subtotal hrs', String(totals.subtotalHrs.toFixed(1))],
      ['Subtotal AED', String(totals.subtotalAed.toFixed(2))],
      [`Discount ${discountPct}%`, String(totals.discountAed.toFixed(2))],
      [`VAT ${vatPct}%`, String(totals.vatAed.toFixed(2))],
      ['Grand Total AED', String(totals.grand.toFixed(2))],
    ]
    const csv = rows.map(r => r.map(c => `"${(c||'').replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoice-${jobRef}-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 text-xs items-end">
        <label>Rate AED/hr<input type="number" value={rate} onChange={e=>setRate(parseFloat(e.target.value)||0)} className="w-20 ml-1 rounded border px-2 py-1 text-right" /></label>
        <label>VAT %<input type="number" value={vatPct} onChange={e=>setVatPct(parseFloat(e.target.value)||0)} className="w-16 ml-1 rounded border px-2 py-1 text-right" /></label>
        <label>Discount %<input type="number" value={discountPct} onChange={e=>setDiscountPct(parseFloat(e.target.value)||0)} className="w-16 ml-1 rounded border px-2 py-1 text-right" /></label>
        <button onClick={exportCsv} className="ml-auto rounded bg-slate-800 text-white px-3 py-1.5 hover:bg-slate-700">Export CSV</button>
      </div>
      <div className="rounded border bg-card overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="bg-muted/20 text-muted-foreground"><th className="text-left px-2 py-1">Structure — Zone — Description</th><th className="text-right px-2 py-1">Qty</th><th className="text-right px-2 py-1">MH/u</th><th className="text-right px-2 py-1">Hrs</th><th className="text-right px-2 py-1">AED</th></tr></thead>
          <tbody>
            {lines.map((l,i) => {
              const hrs = l.quantity * l.unitManhours
              return (
                <tr key={i} className="border-t">
                  <td className="px-2 py-1">{l.structure} — {l.zone} — {l.description}</td>
                  <td className="px-2 py-1 text-right">{l.quantity}</td>
                  <td className="px-2 py-1 text-right">{l.unitManhours}</td>
                  <td className="px-2 py-1 text-right">{hrs.toFixed(2)}</td>
                  <td className="px-2 py-1 text-right">{(hrs*rate).toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="rounded border bg-muted/10 p-3 text-xs space-y-1 max-w-sm ml-auto">
        <div className="flex justify-between"><span>Subtotal {totals.subtotalHrs.toFixed(1)} hrs</span><span>{totals.subtotalAed.toLocaleString()} AED</span></div>
        {discountPct>0 && <div className="flex justify-between text-amber-700"><span>Discount {discountPct}%</span><span>-{totals.discountAed.toLocaleString()} AED</span></div>}
        <div className="flex justify-between"><span>VAT {vatPct}%</span><span>{totals.vatAed.toLocaleString()} AED</span></div>
        <div className="flex justify-between font-semibold border-t pt-1"><span>Grand Total</span><span>{totals.grand.toLocaleString()} AED</span></div>
      </div>
    </div>
  )
}
