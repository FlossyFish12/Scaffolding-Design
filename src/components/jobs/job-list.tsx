import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { JobStatusBadge } from './job-status-badge'
import { JobStatus } from '@/types'

type JobRow = {
  id: string
  projectNumber: string
  title: string
  client: string
  status: JobStatus
  startDate: string | Date
  durationWeeks: number
  _count: { drawings: number }
}

export function JobList({ jobs }: { jobs: JobRow[] }) {
  if (jobs.length === 0) {
    return <p className="text-muted-foreground text-sm">No jobs found. Create your first job.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Project #</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Drawings</TableHead>
          <TableHead>Start Date</TableHead>
          <TableHead>Duration</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => (
          <TableRow key={job.id}>
            <TableCell className="font-mono text-sm">{job.projectNumber}</TableCell>
            <TableCell>
              <Link href={`/jobs/${job.id}`} className="hover:underline font-medium">
                {job.title}
              </Link>
            </TableCell>
            <TableCell>{job.client}</TableCell>
            <TableCell><JobStatusBadge status={job.status} /></TableCell>
            <TableCell>{job._count.drawings}</TableCell>
            <TableCell>{new Date(job.startDate).toLocaleDateString()}</TableCell>
            <TableCell>{job.durationWeeks}w</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
