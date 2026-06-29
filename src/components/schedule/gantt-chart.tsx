'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { weeksInRange, weekLabel, phaseWeeks } from '@/lib/schedule-utils'

export type PhaseRow = {
  id: string
  jobId: string
  type: 'erect' | 'modify' | 'dismantle'
  structureId: string
  startDate: string
  endDate: string
  manhoursTotal: number
}

export type StructureRow = {
  structureId: string
  structureName: string
  drawingId: string
  phases: PhaseRow[]
}

export type GanttJob = {
  jobId: string
  title: string
  projectNumber: string
  structures: StructureRow[]
}

type Props = { jobs: GanttJob[] }

const PHASE_COLORS: Record<string, string> = {
  erect: '#00B451',
  modify: '#1A2F44',
  dismantle: '#E53E3E',
}

const COL_W = 52   // px per week column
const LABEL_W = 220 // px for label column

type EditState = {
  phaseId: string
  jobId: string
  type: 'erect' | 'modify' | 'dismantle'
  startDate: string
  endDate: string
}

type AddState = {
  jobId: string
  structureId: string
  type: 'erect' | 'modify' | 'dismantle'
  startDate: string
  endDate: string
}

export default function GanttChart({ jobs }: Props): React.JSX.Element {
  const [phases, setPhases] = useState<Map<string, PhaseRow>>(() => {
    const m = new Map<string, PhaseRow>()
    for (const j of jobs) for (const s of j.structures) for (const p of s.phases) m.set(p.id, p)
    return m
  })
  const [jobStructures, setJobStructures] = useState<Map<string, StructureRow[]>>(() => {
    const m = new Map<string, StructureRow[]>()
    for (const j of jobs) m.set(j.jobId, j.structures.map(s => ({ ...s, phases: [...s.phases] })))
    return m
  })
  const [editing, setEditing] = useState<EditState | null>(null)
  const [adding, setAdding] = useState<AddState | null>(null)
  const [saving, setSaving] = useState(false)

  // Compute gantt date range from all phases
  const allPhases = [...phases.values()]
  const today = new Date()
  const ganttStart = allPhases.length > 0
    ? new Date(Math.min(...allPhases.map(p => new Date(p.startDate).getTime())))
    : today
  const ganttEnd = allPhases.length > 0
    ? new Date(Math.max(...allPhases.map(p => new Date(p.endDate).getTime())))
    : new Date(today.getTime() + 12 * 7 * 24 * 60 * 60 * 1000)
  const weeks = weeksInRange(ganttStart, ganttEnd)

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch(`/api/jobs/${editing.jobId}/phases/${editing.phaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: editing.type,
          startDate: new Date(editing.startDate).toISOString(),
          endDate: new Date(editing.endDate).toISOString(),
        }),
      })
      if (!res.ok) return
      const updated: PhaseRow = await res.json()
      setPhases(prev => new Map(prev).set(updated.id, { ...prev.get(updated.id)!, ...updated }))
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function deletePhase() {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch(`/api/jobs/${editing.jobId}/phases/${editing.phaseId}`, { method: 'DELETE' })
      if (!res.ok) return
      setPhases(prev => { const m = new Map(prev); m.delete(editing.phaseId); return m })
      setJobStructures(prev => {
        const m = new Map(prev)
        const structs = m.get(editing.jobId)?.map(s => ({
          ...s,
          phases: s.phases.filter(p => p.id !== editing.phaseId),
        }))
        if (structs) m.set(editing.jobId, structs)
        return m
      })
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function addPhase() {
    if (!adding) return
    setSaving(true)
    try {
      const res = await fetch(`/api/jobs/${adding.jobId}/phases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: adding.type,
          structureId: adding.structureId,
          startDate: new Date(adding.startDate).toISOString(),
          endDate: new Date(adding.endDate).toISOString(),
        }),
      })
      if (!res.ok) return
      const created: PhaseRow = await res.json()
      const phaseRow: PhaseRow = { ...created, jobId: adding.jobId }
      setPhases(prev => new Map(prev).set(phaseRow.id, phaseRow))
      setJobStructures(prev => {
        const m = new Map(prev)
        const structs = m.get(adding.jobId)?.map(s =>
          s.structureId === adding.structureId
            ? { ...s, phases: [...s.phases, phaseRow] }
            : s
        )
        if (structs) m.set(adding.jobId, structs)
        return m
      })
      setAdding(null)
    } finally {
      setSaving(false)
    }
  }

  const HEADER = 'px-2 py-1 text-xs font-medium text-muted-foreground border-b border-border'
  const ROW_H = 40 // px per structure row

  return (
    <div className="overflow-auto" style={{ background: 'var(--background)' }}>
      {/* Week header */}
      <div className="flex sticky top-0 z-10" style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ minWidth: LABEL_W, flexShrink: 0 }} />
        {weeks.map((w, i) => (
          <div key={i} className={HEADER} style={{ minWidth: COL_W, flexShrink: 0, textAlign: 'center' }}>
            {weekLabel(w)}
          </div>
        ))}
      </div>

      {/* Jobs */}
      {jobs.map((job) => {
        const structures = jobStructures.get(job.jobId) ?? job.structures
        return (
          <div key={job.jobId}>
            {/* Job header */}
            <div
              className="flex items-center px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: 'var(--navy)', minHeight: 28 }}
            >
              {job.projectNumber} — {job.title}
            </div>

            {/* Structure rows */}
            {structures.map((struct) => {
              const structPhases = struct.phases.map(p => phases.get(p.id) ?? p)
              return (
                <div key={struct.drawingId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex" style={{ minHeight: ROW_H }}>
                    {/* Label */}
                    <div
                      className="flex items-center px-3 py-1 text-sm border-r border-border gap-2"
                      style={{ minWidth: LABEL_W, flexShrink: 0, background: 'var(--card)' }}
                    >
                      <span className="flex-1 truncate">{struct.structureName}</span>
                      <button
                        type="button"
                        className="text-xs font-medium"
                        style={{ color: 'var(--green)' }}
                        onClick={() => setAdding({
                          jobId: job.jobId,
                          structureId: struct.structureId,
                          type: 'erect',
                          startDate: new Date().toISOString().slice(0, 10),
                          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                        })}
                      >
                        + Phase
                      </button>
                    </div>

                    {/* Timeline area */}
                    <div className="relative flex-1" style={{ minHeight: ROW_H }}>
                      {/* Week grid lines */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {weeks.map((_, i) => (
                          <div key={i} style={{ minWidth: COL_W, borderRight: '1px solid var(--border)', opacity: 0.4 }} />
                        ))}
                      </div>

                      {/* Phase bars */}
                      {structPhases.map((phase) => {
                        const { startCol, spanCols } = phaseWeeks(phase, weeks[0] ?? ganttStart)
                        const left = startCol * COL_W
                        const width = spanCols * COL_W - 2
                        return (
                          <button
                            key={phase.id}
                            type="button"
                            onClick={() => setEditing({
                              phaseId: phase.id,
                              jobId: job.jobId,
                              type: phase.type,
                              startDate: phase.startDate.slice(0, 10),
                              endDate: phase.endDate.slice(0, 10),
                            })}
                            className="absolute top-2 rounded text-white text-xs font-medium px-1 truncate"
                            style={{
                              left,
                              width,
                              height: ROW_H - 16,
                              background: PHASE_COLORS[phase.type],
                            }}
                            aria-label={`${phase.type} phase for ${struct.structureName}`}
                          >
                            {phase.type}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Add phase inline form */}
                  {adding?.jobId === job.jobId && adding.structureId === struct.structureId && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-card border-t border-border text-sm">
                      <select
                        value={adding.type}
                        onChange={e => setAdding(a => a && ({ ...a, type: e.target.value as 'erect' | 'modify' | 'dismantle' }))}
                        className="border border-border rounded px-2 py-1 text-xs"
                      >
                        <option value="erect">Erect</option>
                        <option value="modify">Modify</option>
                        <option value="dismantle">Dismantle</option>
                      </select>
                      <input
                        type="date"
                        value={adding.startDate}
                        onChange={e => setAdding(a => a && ({ ...a, startDate: e.target.value }))}
                        className="border border-border rounded px-2 py-1 text-xs"
                        aria-label="Phase start date"
                      />
                      <span className="text-muted-foreground">→</span>
                      <input
                        type="date"
                        value={adding.endDate}
                        onChange={e => setAdding(a => a && ({ ...a, endDate: e.target.value }))}
                        className="border border-border rounded px-2 py-1 text-xs"
                        aria-label="Phase end date"
                      />
                      <Button
                        type="button"
                        disabled={saving}
                        onClick={addPhase}
                        style={{ fontSize: 12, padding: '2px 10px', background: 'var(--green)', color: '#fff' }}
                      >
                        {saving ? '…' : 'Add'}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setAdding(null)}
                        style={{ fontSize: 12, padding: '2px 8px' }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Edit phase overlay */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditing(null) }}
        >
          <div className="bg-card rounded-lg border border-border p-5 w-80 space-y-4 shadow-lg">
            <h3 className="text-sm font-semibold">Edit Phase</h3>
            <div>
              <label htmlFor="edit-type" className="block text-xs text-muted-foreground mb-1">Type</label>
              <select
                id="edit-type"
                value={editing.type}
                onChange={e => setEditing(ed => ed && ({ ...ed, type: e.target.value as 'erect' | 'modify' | 'dismantle' }))}
                className="w-full border border-border rounded px-2 py-1 text-sm"
              >
                <option value="erect">Erect</option>
                <option value="modify">Modify</option>
                <option value="dismantle">Dismantle</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-start" className="block text-xs text-muted-foreground mb-1">Start Date</label>
              <input
                id="edit-start"
                type="date"
                value={editing.startDate}
                onChange={e => setEditing(ed => ed && ({ ...ed, startDate: e.target.value }))}
                className="w-full border border-border rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label htmlFor="edit-end" className="block text-xs text-muted-foreground mb-1">End Date</label>
              <input
                id="edit-end"
                type="date"
                value={editing.endDate}
                onChange={e => setEditing(ed => ed && ({ ...ed, endDate: e.target.value }))}
                className="w-full border border-border rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                disabled={saving}
                onClick={saveEdit}
                style={{ flex: 1, background: 'var(--green)', color: '#fff' }}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={deletePhase}
                style={{ background: 'var(--destructive)', color: '#fff' }}
              >
                Delete
              </Button>
              <Button type="button" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {jobs.length === 0 && (
        <div className="p-8 text-center text-muted-foreground text-sm">
          No jobs with phases yet. Open a job and add phases from here.
        </div>
      )}
    </div>
  )
}
