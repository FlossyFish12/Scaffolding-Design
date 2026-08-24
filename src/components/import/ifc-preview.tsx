'use client'
import { useState } from 'react'

type IfcStats = { walls: number; slabs: number; beams: number; columns: number; total: number; project: string }

export default function IfcPreview() {
  const [stats, setStats] = useState<IfcStats | null>(null)
  const [filename, setFilename] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFilename(file.name)
    setError(null)
    setStats(null)
    try {
      const text = await file.text()
      // Lightweight IFC text scan — no WASM needed for preview
      const upper = text.toUpperCase()
      const count = (re: RegExp) => (upper.match(re) || []).length
      const walls = count(/IFCWALL/g)
      const slabs = count(/IFCSLAB/g)
      const beams = count(/IFCBEAM/g)
      const columns = count(/IFCCOLUMN/g)
      const total = walls + slabs + beams + columns
      const projMatch = text.match(/IFCPROJECT[^']*'([^']+)'/i)
      const project = projMatch ? projMatch[1] : file.name.replace(/\.ifc$/i, '')
      if (!upper.includes('ISO-10303-21') && !upper.includes('IFC')) {
        throw new Error('Not a valid IFC file (missing ISO-10303-21 header)')
      }
      setStats({ walls, slabs, beams, columns, total, project })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parse failed')
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold">IFC / TEKLA Import (Preview)</h3>
      <p className="text-xs text-muted-foreground">Upload .ifc (or Tekla exported IFC) to count structural elements and suggest scaffold zones. Full geometry streaming is P5-next.</p>
      <input type="file" accept=".ifc,.ifczip,.stp" onChange={handleFile} className="text-xs" />
      {filename && <p className="text-xs">File: {filename}</p>}
      {error && <p className="text-xs text-red-600 border border-red-200 bg-red-50 rounded p-2">{error}</p>}
      {stats && (
        <div className="text-xs space-y-2">
          <div className="font-medium">Project: {stats.project} — {stats.total} structural entities</div>
          <div className="grid grid-cols-2 gap-1 border rounded p-2 bg-muted/20">
            <span>Walls: {stats.walls}</span><span>Slabs: {stats.slabs}</span>
            <span>Beams: {stats.beams}</span><span>Columns: {stats.columns}</span>
          </div>
          <div className="text-muted-foreground">
            Suggestion: {stats.walls > 10 ? 'Perimeter scaffold (independent) around walls' : stats.columns > 8 ? 'Birdcage around columns' : 'Independent scaffold'}
            {stats.total > 0 && ` — create ${Math.min(4, Math.max(1, Math.ceil(stats.total / 12)))} zones from model`}
          </div>
          <p className="text-muted-foreground">Next: auto-generate zones per IfcBuildingStorey and export to Drawing Editor.</p>
        </div>
      )}
    </div>
  )
}
