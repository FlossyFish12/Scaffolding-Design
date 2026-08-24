'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'

const PdfViewer = dynamic(() => import('@/components/drawing-editor/pdf-viewer'), { ssr: false })
const CanvasLayer = dynamic(() => import('@/components/drawing-editor/canvas-layer'), { ssr: false })

type Rect = { x: number; y: number; width: number; height: number; label: string }

export default function AiDemo() {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [zones, setZones] = useState<Rect[]>([])
  const [renderWidth, setRenderWidth] = useState(0)
  const [renderHeight, setRenderHeight] = useState(0)
  const [scale] = useState(2.0)
  const [filename, setFilename] = useState('')

  function aiDetect() {
    if (!renderWidth || !renderHeight) return
    const scaleFactor = scale / 100
    const wM = (renderWidth * 0.48) * scaleFactor
    const hM = (renderHeight * 0.9) * scaleFactor
    const perim = Math.round(2 * (wM + hM) * 10) / 10
    const area = Math.round(wM * hM * 10) / 10
    const newZones: Rect[] = [
      { x: 0, y: 0, width: renderWidth * 0.48, height: renderHeight * 0.9, label: `AI Zone 1 — ${perim}m perim · ${area}m²` },
      { x: renderWidth * 0.52, y: 0, width: renderWidth * 0.48, height: renderHeight * 0.9, label: `AI Zone 2 — ${perim}m perim · ${area}m²` },
    ]
    setZones(newZones)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFilename(file.name)
    setZones([])
    const url = URL.createObjectURL(file)
    setBlobUrl(url)
  }

  // Quick pick from Downloads for demo (if running locally, user can also use file picker)
  const samplePdfs = [
    '5-MAY-2025 MFY LAYOUT- R0 (01-05-25).pdf',
    '6-JUNE-2025 MFY LAYOUT- R0 (02-06-25).pdf',
    '2300-O-SK-0001-ZTPS3-001 Post loadout.pdf',
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">AI Detect — Real Drawings Demo</h1>
        <p className="text-sm text-muted-foreground">Upload any GA PDF (e.g., MFY Layout) — renders via PDF.js, then ✨ AI Detect splits into zones. No DB needed.</p>
      </div>
      <div className="flex gap-3 items-center text-xs">
        <input type="file" accept=".pdf" onChange={handleFile} className="text-xs" />
        {filename && <span className="text-muted-foreground">{filename} — {renderWidth}×{renderHeight}px</span>}
        <button onClick={aiDetect} disabled={!blobUrl || !renderWidth} className="ml-auto rounded bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50">✨ AI Detect — split page</button>
        <button onClick={() => setZones([])} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
      </div>
      <div className="text-xs text-muted-foreground">
        Samples in ~/Downloads: {samplePdfs.join(' · ')} — pick via file chooser above (open ~/Downloads in Finder).
      </div>
      {!blobUrl ? (
        <div className="border-2 border-dashed rounded p-12 text-center text-sm text-muted-foreground">
          Upload a PDF to preview and test AI Detect
          <div className="mt-2 text-xs">Heuristic: 48% + 52% width, 90% height, scale 2m/100px → perim/area. Real ML would use cv.js contours on rendered canvas.</div>
        </div>
      ) : (
        <div className="relative inline-block border bg-white">
          <PdfViewer blobUrl={blobUrl} page={1} onPageCount={() => {}} onRenderSize={(w,h)=>{setRenderWidth(w); setRenderHeight(h)}} />
          {renderWidth>0 && renderHeight>0 && (
            <CanvasLayer
              width={renderWidth}
              height={renderHeight}
              zones={zones.map((z,i)=>({ id:`ai-${i}`, label:z.label, canvasData:{x:z.x,y:z.y,width:z.width,height:z.height}, selected:false }))}
              onDraftComplete={()=>{}}
              onSelectZone={()=>{}}
            />
          )}
        </div>
      )}
      <div className="text-xs text-muted-foreground">
        Zones: {zones.length} — {zones.map(z => z.label).join(' | ') || 'none — upload PDF then click AI Detect'}
      </div>
      <p className="text-xs">Code: <code>drawing-editor.tsx:259</code> — in real editor, each rect POSTs to <code>/api/jobs/[id]/drawings/[id]/zones</code> with <code>heightM 6 ground/light</code>.</p>
    </div>
  )
}
