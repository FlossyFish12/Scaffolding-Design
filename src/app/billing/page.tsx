import Link from 'next/link'
import { prisma } from '@/lib/db'

export default async function BillingIndex() {
  let jobs: any[] = []
  try {
    jobs = await prisma.job.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
  } catch {}
  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold">Billing</h1>
      <p className="text-sm text-muted-foreground">Select a job to view invoice</p>
      <div className="space-y-2">
        {jobs.map(j => (
          <Link key={j.id} href={`/jobs/${j.id}/billing`} className="block rounded border p-3 hover:bg-muted/20">
            <div className="text-sm font-medium">{j.projectNumber} — {j.title}</div>
            <div className="text-xs text-muted-foreground">{j.client}</div>
          </Link>
        ))}
        {jobs.length===0 && <p className="text-sm text-muted-foreground">No jobs yet</p>}
      </div>
    </div>
  )
}
