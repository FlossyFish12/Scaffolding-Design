import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import Invoice from '@/components/billing/invoice'

type Params = { params: Promise<{ jobId: string }> }

export default async function BillingPage({ params }: Params) {
  const { jobId } = await params
  let job
  try {
    job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { drawings: { include: { zones: { include: { estimateItems: true } } } } },
    })
  } catch { job = null }
  if (!job) notFound()

  const lines = job.drawings.flatMap(d =>
    d.zones.flatMap(z =>
      z.estimateItems.filter(i => i.category === 'labour').map(i => ({
        description: i.description,
        quantity: i.quantity,
        unitManhours: i.unitManhours,
        structure: d.structureName,
        zone: z.label,
      }))
    )
  )

  return (
    <div className="p-6 space-y-6 overflow-auto h-full max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Billing — {job.projectNumber}</h1>
        <p className="text-sm text-muted-foreground">{job.title} · {lines.length} labour lines · manhours→AED + VAT</p>
      </div>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">No labour lines yet — generate estimates first.</p>
      ) : (
        <Invoice lines={lines} jobRef={job.projectNumber} />
      )}
    </div>
  )
}
