import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { DrawingList } from '@/components/drawings/drawing-list'
import { UploadDrawingForm } from '@/components/drawings/upload-drawing-form'
import { JobStatusBadge } from '@/components/jobs/job-status-badge'

type Params = { params: Promise<{ jobId: string }> }

export default async function JobDetailPage({ params }: Params) {
  const { jobId } = await params
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { drawings: { orderBy: { structureId: 'asc' } } },
  })
  if (!job) notFound()

  return (
    <div className="p-6 overflow-auto h-full space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-mono">{job.projectNumber}</p>
          <h1 className="text-2xl font-semibold">{job.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {job.client} · {job.durationWeeks} weeks · starts {new Date(job.startDate).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button render={<Link href={`/jobs/${job.id}/estimate`} />}>
            View Estimate
          </Button>
          <JobStatusBadge status={job.status} />
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Drawings</h2>
        <DrawingList drawings={job.drawings} jobId={job.id} />
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium mb-3">Upload Drawing</h3>
          <UploadDrawingForm jobId={job.id} />
        </div>
      </section>
    </div>
  )
}
