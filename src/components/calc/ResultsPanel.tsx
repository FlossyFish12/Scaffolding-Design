'use client'
import { CalcResult } from '@/lib/calc/types'

interface ResultsPanelProps {
  result: CalcResult
}

const VERDICT_STYLES = {
  compliant: {
    bg: 'bg-green-900/40 border-green-700',
    text: 'text-green-400',
    label: '✓ COMPLIANT',
  },
  non_compliant: {
    bg: 'bg-amber-900/40 border-amber-700',
    text: 'text-amber-400',
    label: '⚠ NON-COMPLIANT',
  },
  requires_engineer: {
    bg: 'bg-red-900/40 border-red-700',
    text: 'text-red-400',
    label: '✗ REQUIRES ENGINEER SIGN-OFF',
  },
}

function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ResultsPanel({ result }: ResultsPanelProps) {
  const style = VERDICT_STYLES[result.verdict]

  return (
    <div className="space-y-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Results</p>

      <div className={`rounded-lg border p-4 text-center ${style.bg}`}>
        <p className={`text-base font-bold ${style.text}`}>{style.label}</p>
        <p className="text-xs text-slate-400 mt-1">Job: {result.jobRef}</p>
      </div>

      {result.checks.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Checks</p>
          {(() => {
            const passCount = result.checks.filter(c => c.passed).length
            const totalCount = result.checks.length
            return <p className="text-xs text-slate-400 mb-2">{passCount}/{totalCount} checks passed</p>
          })()}
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700">
                <th className="text-left py-1 pr-2 font-normal">Check</th>
                <th className="text-left py-1 pr-2 font-normal">Actual</th>
                <th className="text-left py-1 pr-2 font-normal">Limit</th>
                <th className="text-left py-1 pr-2 font-normal">Clause</th>
                <th className="py-1 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {result.checks.map((c, i) => (
                <tr key={i} className={`border-b border-slate-800${c.passed ? '' : ' bg-red-950/30'}`}>
                  <td className="py-1.5 pr-2 text-slate-300">{c.name}</td>
                  <td className="py-1.5 pr-2 text-slate-300">{c.actual} {c.unit}</td>
                  <td className="py-1.5 pr-2 text-slate-300">{c.limit} {c.unit}</td>
                  <td className="py-1.5 pr-2 text-slate-500">{c.clause}</td>
                  <td className={`py-1.5 font-semibold ${c.passed ? 'text-green-400' : 'text-red-400'}`}>
                    {c.passed ? '✓' : '✗'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="rounded bg-amber-900/20 border border-amber-800 p-3">
          <p className="text-xs font-semibold text-amber-400 mb-1">Warnings</p>
          <ul className="space-y-1">
            {result.warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-200">• {w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => downloadMarkdown(result.calcSheet, `${result.jobRef}-calc.md`)}
          className="rounded bg-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-600 transition-colors"
        >
          ↓ Calc Sheet (.md)
        </button>
        <button
          onClick={() => downloadMarkdown(result.methodStatement, `${result.jobRef}-method.md`)}
          className="rounded bg-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-600 transition-colors"
        >
          ↓ Method Statement (.md)
        </button>
        <button
          onClick={() => window.print()}
          className="rounded bg-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-600 transition-colors print:hidden"
        >
          ⎙ Print
        </button>
      </div>
    </div>
  )
}
