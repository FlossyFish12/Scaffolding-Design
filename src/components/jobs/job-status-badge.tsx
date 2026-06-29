import { Badge } from '@/components/ui/badge'
import { JobStatus } from '@/types'

const variantMap: Record<JobStatus, 'secondary' | 'default' | 'outline'> = {
  draft: 'secondary',
  estimated: 'default',
  approved: 'outline',
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge variant={variantMap[status]}>{status}</Badge>
}
