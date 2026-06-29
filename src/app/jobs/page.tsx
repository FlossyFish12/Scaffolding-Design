import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { JobList } from '@/components/jobs/job-list'
import { prisma } from '@/lib/db'

export default async function JobsPage() {
  const jobs = await prisma.job.findMany({
    include: { _count: { select: { drawings: true } } },
    orderBy: { createdAt: 'desc' },
  })

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
