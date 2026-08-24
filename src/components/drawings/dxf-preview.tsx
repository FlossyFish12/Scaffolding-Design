'use client'
import { useState } from 'react'

type DxfEntity = { type: string; [k: string]: any }

export default function DxfPreview() {
  const [entities, setEntities] = useState<DxfEntity[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filename, setFilename] = useState<string>('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFilename(file.name)
    setError(null)
    setEntities(null)
    try {
      const text = await file.text()
      const DxfParser = (await import('dxf-parser')).default
      const parser = new DxfParser()
      const dxf = parser.parse(text) as any
      const ents: DxfEntity[] = dxf.entities || []
      setEntities(ents)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse DXF')
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold">DXF Import (Preview)</h3>
      <p className="text-xs text-muted-foreground">Upload a 2D DXF (e.g., plan/section) to count entities and validate for zone tracing. Full DXF→zone auto-trace is P3-next.</p>
      <input type="file" accept=".dxf" onChange={handleFile} className="text-xs" />
      {filename && <p className="text-xs">File: {filename}</p>}
      {error && <p className="text-xs text-red-600 border border-red-200 bg-red-50 rounded p-2">{error}</p>}
      {entities && (
        <div className="text-xs space-y-1">
          <div className="font-medium">{entities.length} entities</div>
          <div className="max-h-32 overflow-auto border rounded p-2 bg-muted/20">
            {Object.entries(
              entities.reduce((acc: Record<string, number>, e) => {
                acc[e.type] = (acc[e.type] || 0) + 1
                return acc
              }, {})
            ).map(([type, count]) => (
              <div key={type} className="flex justify-between"><span>{type}</span><span>{count}</span></div>
            ))}
          </div>
          <p className="text-muted-foreground">Tip: Use PDF import for GA drawings; DXF is for CAD plan overlay reference.</p>
        </div>
      )}
    </div>
  )
}
