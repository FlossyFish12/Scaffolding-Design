'use client'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import ZonePanel, { ZoneFormValues, TemplateSummary } from './zone-panel'
import type { CanvasRect, ZoneOverlay } from './canvas-layer'

const PdfViewer = dynamic(() => import('./pdf-viewer'), { ssr: false })
const CanvasLayer = dynamic(() => import('./canvas-layer'), { ssr: false })

type Zone = {
  id: string
  drawingId: string
  pageNumber: number
  label: string
  canvasData: CanvasRect
  accessType: 'ground' | 'elevated' | 'confined' | 'overhead'
  loadingClass: 'light' | 'medium' | 'heavy'
  heightM: number
  perimeterM: number
  areaM2: number
  scaffoldType: 'independent' | 'birdcage' | 'putlog' | 'suspended' | 'cantilever'
  templateId: string | null
  createdAt: string
}

type Drawing = {
  id: string
  jobId: string
  structureId: string
  structureName: string
  filename: string
  blobUrl: string
  pageCount: number
}

type Props = {
  drawing: Drawing
  initialZones: Zone[]
}

export default function DrawingEditor({ drawing, initialZones }: Props) {
  const [zones, setZones] = useState<Zone[]>(initialZones)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(drawing.pageCount)
  const [renderWidth, setRenderWidth] = useState(0)
  const [renderHeight, setRenderHeight] = useState(0)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [draftRect, setDraftRect] = useState<CanvasRect | null>(null)
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [scaleMetersPer100px, setScaleMetersPer100px] = useState(2.0)

  useEffect(() => {
    fetch('/api/templates')
      .then((r) => r.json())
      .then((data: TemplateSummary[]) => setTemplates(data))
      .catch(() => {})
  }, [])

  const handlePageCount = useCallback((n: number) => setTotalPages(n), [])
  const handleRenderSize = useCallback((w: number, h: number) => {
    setRenderWidth(w)
    setRenderHeight(h)
  }, [])

  const pageZones: ZoneOverlay[] = zones
    .filter((z) => z.pageNumber === currentPage)
    .map((z) => ({ id: z.id, label: z.label, canvasData: z.canvasData, selected: z.id === selectedZoneId }))

  function handleDraftComplete(rect: CanvasRect) {
    setSelectedZoneId(null)
    setDraftRect(rect)
  }

  function handleSelectZone(id: string) {
    setDraftRect(null)
    setSelectedZoneId(id)
  }

  function closePanel() {
    setDraftRect(null)
    setSelectedZoneId(null)
  }

  const selectedZone = selectedZoneId ? zones.find((z) => z.id === selectedZoneId) : null

  const panelMode: 'new' | 'edit' | null =
    draftRect ? 'new' : selectedZone ? 'edit' : null

  async function handleSave(values: ZoneFormValues) {
    if (draftRect) {
      const res = await fetch(`/api/jobs/${drawing.jobId}/drawings/${drawing.id}/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageNumber: currentPage, canvasData: draftRect, ...values }),
      })
      if (!res.ok) throw new Error('Failed to save zone')
      const newZone: Zone = await res.json()
      setZones((prev) => [...prev, newZone])
      setDraftRect(null)
      setSelectedZoneId(newZone.id)
    } else if (selectedZone) {
      const res = await fetch(
        `/api/jobs/${drawing.jobId}/drawings/${drawing.id}/zones/${selectedZone.id}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) },
      )
      if (!res.ok) throw new Error('Failed to update zone')
      const updated: Zone = await res.json()
      setZones((prev) => prev.map((z) => (z.id === updated.id ? updated : z)))
    }
  }

  async function handleDelete() {
    if (!selectedZone) return
    const res = await fetch(
      `/api/jobs/${drawing.jobId}/drawings/${drawing.id}/zones/${selectedZone.id}`,
      { method: 'DELETE' },
    )
    if (!res.ok) throw new Error('Failed to delete zone')
    setZones((prev) => prev.filter((z) => z.id !== selectedZone.id))
    setSelectedZoneId(null)
  }

  async function handleGenerateEstimate(templateId: string | undefined) {
    if (!selectedZone) return
    const res = await fetch(
      `/api/jobs/${drawing.jobId}/drawings/${drawing.id}/zones/${selectedZone.id}/estimate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateId ? { templateId } : {}),
      },
    )
    if (!res.ok) throw new Error('Failed to generate estimate')
  }

  // Derived footprint dimensions from draft rect × scale (for new zone)
  const draftDerived = draftRect ? (() => {
    const scale = scaleMetersPer100px / 100
    const wM = draftRect.width * scale
    const hM = draftRect.height * scale
    const perimeter = Math.round(2 * (wM + hM) * 10) / 10
    const area = Math.round(wM * hM * 10) / 10
    return { perimeterM: perimeter, areaM2: area }
  })() : null

  const panelInitialValues: Partial<ZoneFormValues> | undefined = selectedZone
    ? {
        label: selectedZone.label,
        accessType: selectedZone.accessType,
        loadingClass: selectedZone.loadingClass,
        heightM: selectedZone.heightM,
        perimeterM: selectedZone.perimeterM,
        areaM2: selectedZone.areaM2,
        scaffoldType: selectedZone.scaffoldType,
        templateId: selectedZone.templateId,
      }
    : draftDerived ? {
        label: '',
        accessType: 'ground',
        loadingClass: 'light',
        heightM: 6,
        perimeterM: draftDerived.perimeterM,
        areaM2: draftDerived.areaM2,
        scaffoldType: 'independent',
        templateId: null,
      } : undefined

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0 bg-card">
        <div>
          <span className="text-sm font-medium">{drawing.filename}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {drawing.structureName} ({drawing.structureId})
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-xs">
            Scale
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={scaleMetersPer100px}
              onChange={e => setScaleMetersPer100px(parseFloat(e.target.value) || 2.0)}
              className="w-14 rounded border px-1 py-0.5 text-xs text-right"
              title="meters per 100px — set from known dimension on PDF"
            />
            <span className="text-muted-foreground">m/100px</span>
          </label>
          {draftDerived && (
            <span className="text-xs text-muted-foreground hidden lg:inline">
              ↳ {draftDerived.perimeterM}m perim · {draftDerived.areaM2}m²
            </span>
          )}
          <Button
            type="button"
            onClick={async () => {
              if (!renderWidth || !renderHeight) return
              if (!confirm('AI auto-detect: create 2 suggested zones splitting this page?')) return
              const scale = scaleMetersPer100px / 100
              const zonesToCreate = [
                { x: 0, y: 0, width: renderWidth * 0.48, height: renderHeight * 0.9 },
                { x: renderWidth * 0.52, y: 0, width: renderWidth * 0.48, height: renderHeight * 0.9 },
              ]
              for (let i = 0; i < zonesToCreate.length; i++) {
                const rect = zonesToCreate[i]
                const wM = rect.width * scale
                const hM = rect.height * scale
                const perim = Math.round(2 * (wM + hM) * 10) / 10
                const area = Math.round(wM * hM * 10) / 10
                try {
                  const res = await fetch(`/api/jobs/${drawing.jobId}/drawings/${drawing.id}/zones`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      pageNumber: currentPage,
                      canvasData: rect,
                      label: `AI Zone ${zones.length + i + 1}`,
                      accessType: 'ground',
                      loadingClass: 'light',
                      heightM: 6,
                      perimeterM: perim,
                      areaM2: area,
                      scaffoldType: 'independent',
                      templateId: null,
                    }),
                  })
                  if (res.ok) {
                    const nz: Zone = await res.json()
                    setZones(prev => [...prev, nz])
                  }
                } catch {}
              }
            }}
            style={{ fontSize: 11, padding: '2px 8px', background: 'var(--navy)', color: '#fff' }}
            title="AI: split page into 2 zones (demo)"
          >
            ✨ AI Detect
          </Button>
          <Button
            render={<Link href={`/jobs/${drawing.jobId}/estimate`} />}
            style={{ fontSize: 12, padding: '2px 10px', background: 'var(--green)', color: '#fff' }}
          >
            View Estimate
          </Button>
          <span className="text-xs text-muted-foreground">
            {pageZones.length} zone{pageZones.length !== 1 ? 's' : ''} on page
          </span>
          {/* Page navigation */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              aria-label="Previous page"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              style={{ padding: '2px 8px', fontSize: 12 }}
            >
              ‹
            </Button>
            <span className="text-xs text-muted-foreground w-16 text-center">
              {currentPage} / {totalPages}
            </span>
            <Button
              type="button"
              aria-label="Next page"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              style={{ padding: '2px 8px', fontSize: 12 }}
            >
              ›
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 overflow-auto bg-muted p-4">
          <div className="relative inline-block" style={{ minWidth: renderWidth || 'auto' }}>
            <PdfViewer
              blobUrl={drawing.blobUrl}
              page={currentPage}
              onPageCount={handlePageCount}
              onRenderSize={handleRenderSize}
            />
            {renderWidth > 0 && renderHeight > 0 && (
              <CanvasLayer
                width={renderWidth}
                height={renderHeight}
                zones={pageZones}
                onDraftComplete={handleDraftComplete}
                onSelectZone={handleSelectZone}
              />
            )}
          </div>
        </div>

        {/* Zone panel */}
        {panelMode && (
          <ZonePanel
            key={selectedZoneId ?? 'new'}
            mode={panelMode}
            zoneId={selectedZoneId ?? undefined}
            initialValues={panelInitialValues}
            templates={templates}
            onSave={handleSave}
            onDelete={panelMode === 'edit' ? handleDelete : undefined}
            onGenerateEstimate={panelMode === 'edit' ? handleGenerateEstimate : undefined}
            onClose={closePanel}
          />
        )}
      </div>

      {/* Footer hint */}
      {!panelMode && (
        <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border bg-card flex-shrink-0">
          Drag on the PDF to draw a new zone · Click an existing zone to edit it
        </div>
      )}
    </div>
  )
}
