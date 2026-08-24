import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import SafetyChecklist from '@/components/safety/checklist'

type Params = { params: Promise<{ jobId: string }> }

export default async function SafetyPage({ params }: Params) {
  const { jobId } = await params
  let job
  try {
    job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { drawings: { include: { zones: true }, orderBy: { structureId: 'asc' } } },
    })
  } catch { job = null }
  if (!job) notFound()

  const zones = job.drawings.flatMap(d => d.zones.map(z => ({ id: z.id, label: z.label, structure: d.structureName })))

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div>
        <h1 className="text-xl font-semibold">Safety — {job.projectNumber}</h1>
        <p className="text-sm text-muted-foreground">{job.title} · {zones.length} zones</p>
      </div>
      <SafetyChecklist title={`Job ${job.projectNumber} — Global`} zoneId={jobId} />
      <div className="grid gap-6 md:grid-cols-2">
        {zones.map(z => (
          <SafetyChecklist key={z.id} zoneId={z.id} title={`${z.label} — ${z.structure}`} />
        ))}
      </div>
      {zones.length === 0 && <p className="text-sm text-muted-foreground">No zones yet — create zones in Drawing Editor to get per-zone checklists.</p>}
    </div>
  )
}
