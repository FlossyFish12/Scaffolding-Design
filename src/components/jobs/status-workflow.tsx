'use client'
import { useState, useEffect } from 'react'

const ROLES = ['designer', 'engineer', 'manager'] as const
type Role = typeof ROLES[number]
const STATUS = ['draft', 'estimated', 'approved'] as const

const TRANSITIONS: Record<string, { to: string; role: Role; label: string }[]> = {
  draft: [{ to: 'estimated', role: 'designer', label: 'Submit for Estimate → estimated (designer)' }],
  estimated: [
    { to: 'approved', role: 'manager', label: 'Approve → approved (manager)' },
    { to: 'draft', role: 'engineer', label: 'Request Changes → draft (engineer)' },
  ],
  approved: [{ to: 'draft', role: 'manager', label: 'Reopen → draft (manager)' }],
}

export default function StatusWorkflow({ jobId, initialStatus }: { jobId: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus)
  const [role, setRole] = useState<Role>('designer')
  const [msg, setMsg] = useState<string | null>(null)
  const [audit, setAudit] = useState<{ at: string; from: string; to: string; role: string }[]>([])

  useEffect(() => {
    const r = localStorage.getItem('scaffold-role') as Role | null
    if (r && ROLES.includes(r)) setRole(r)
    const a = localStorage.getItem(`audit-${jobId}`)
    if (a) try { setAudit(JSON.parse(a)) } catch {}
  }, [jobId])

  useEffect(() => { localStorage.setItem('scaffold-role', role) }, [role])

  async function transition(to: string) {
    setMsg(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: to }),
      })
      if (!res.ok) throw new Error('Update failed')
      const entry = { at: new Date().toISOString(), from: status, to, role }
      const next = [...audit, entry]
      setAudit(next)
      localStorage.setItem(`audit-${jobId}`, JSON.stringify(next))
      setStatus(to)
      setMsg(`✓ ${status} → ${to} as ${role}`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed')
    }
  }

  const options = TRANSITIONS[status] || []

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Workflow — {status}</h3>
        <span className={`text-xs px-2 py-1 rounded font-medium ${status==='approved'?'bg-green-100 text-green-800':status==='estimated'?'bg-amber-100 text-amber-800':'bg-slate-100 text-slate-700'}`}>{status}</span>
      </div>
      <label className="flex items-center gap-2 text-xs">
        Role
        <select value={role} onChange={e=>setRole(e.target.value as Role)} className="rounded border px-2 py-1">
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <span className="text-muted-foreground">Switch to test approvals</span>
      </label>
      <div className="space-y-1">
        {options.length === 0 ? (
          <p className="text-xs text-muted-foreground">No transitions from {status}</p>
        ) : (
          options.map(o => (
            <button
              key={o.to}
              onClick={() => transition(o.to)}
              disabled={role !== o.role}
              className={`w-full text-left text-xs rounded border px-3 py-2 ${role===o.role ? 'bg-white hover:bg-muted/50 border-border' : 'bg-muted/20 text-muted-foreground cursor-not-allowed'}`}
              title={role!==o.role ? `Requires ${o.role}` : ''}
            >
              {o.label} {role!==o.role && `(needs ${o.role})`}
            </button>
          ))
        )}
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      {audit.length>0 && (
        <div className="border-t pt-2">
          <p className="text-xs font-medium mb-1">Audit</p>
          <div className="max-h-28 overflow-auto space-y-0.5 text-xs font-mono">
            {audit.slice(-5).reverse().map((a,i) => (
              <div key={i} className="flex justify-between"><span>{a.from}→{a.to} {a.role}</span><span className="text-muted-foreground">{new Date(a.at).toLocaleString()}</span></div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
