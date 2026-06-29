import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { JobList } from '@/components/jobs/job-list'
import { prisma } from '@/lib/db'

export default async function JobsPage() {
  let jobs: Awaited<ReturnType<typeof prisma.job.findMany>> = []
  try {
    jobs = await prisma.job.findMany({
      include: { _count: { select: { drawings: true } } },
      orderBy: { createdAt: 'desc' },
    })
  } catch {
    // DB not yet connected (local dev) — show empty state
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <Button render={<Link href="/jobs/new" />}>New Job</Button>
      </div>
      <JobList jobs={jobs} />
    </div>
  )
}
