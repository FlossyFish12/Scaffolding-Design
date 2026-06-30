import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { JobList } from '@/components/jobs/job-list'
import { prisma } from '@/lib/db'

type JobsResult = Prisma.JobGetPayload<{ include: { _count: { select: { drawings: true } } } }>[]

export default async function JobsPage() {
  let jobs: JobsResult = []
  try {
    jobs = await prisma.job.findMany({
      include: { _count: { select: { drawings: true } } },
      orderBy: { createdAt: 'desc' },
    })
  } catch {
    // DB not yet connected (local dev) — show empty state
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <Button nativeButton={false} render={<Link href="/jobs/new" />}>New Job</Button>
      </div>
      <JobList jobs={jobs} />
    </div>
  )
}
