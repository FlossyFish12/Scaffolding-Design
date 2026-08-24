'use client'

import type { MtoResult } from '@/lib/calc/mto'

interface MtoPanelProps {
  mto: MtoResult
  jobRef: string
}

export default function MtoPanel({ mto, jobRef }: MtoPanelProps) {
  const { items } = mto

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        Material Take-Off
      </p>

      {/* summary line */}
      <p className="text-xs text-slate-400">
        {items.length} material types • quantities are indicative (add 10% waste)
      </p>

      {/* table */}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-500 border-b border-slate-700">
            <th className="text-left py-1 pr-2 font-normal">Item</th>
            <th className="text-right py-1 pr-2 font-normal">Qty</th>
            <th className="text-left py-1 pr-2 font-normal">Unit</th>
            <th className="text-left py-1 font-normal hidden sm:table-cell">Notes</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, idx) => (
            <tr
              key={row.item}
              className={idx % 2 === 0 ? 'bg-slate-800/30' : ''}
            >
              <td className="py-1 pr-2 text-slate-300">{row.item}</td>
              <td className="py-1 pr-2 text-right text-slate-300">{row.qty}</td>
              <td className="py-1 pr-2 text-slate-400">{row.unit}</td>
              <td className="py-1 text-slate-500 hidden sm:table-cell">{row.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* download button */}
      <button
        onClick={() => {
          const blob = new Blob([mto.markdownTable], { type: 'text/markdown' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${jobRef}-mto.md`
          a.click()
          URL.revokeObjectURL(url)
        }}
        className="rounded bg-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-600 transition-colors"
      >
        ↓ MTO (.md)
      </button>
    </div>
  )
}
