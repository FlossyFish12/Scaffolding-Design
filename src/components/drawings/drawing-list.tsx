import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type DrawingItem = {
  id: string
  structureId: string
  structureName: string
  filename: string
  blobUrl: string
  pageCount: number
  createdAt: string
}

export function DrawingList({ drawings, jobId }: { drawings: DrawingItem[]; jobId: string }) {
  if (drawings.length === 0) {
    return <p className="text-muted-foreground text-sm">No drawings uploaded yet.</p>
  }

  const byStructure = drawings.reduce<Record<string, DrawingItem[]>>((acc, d) => {
    acc[d.structureId] = acc[d.structureId] ?? []
    acc[d.structureId].push(d)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {Object.entries(byStructure).map(([structureId, items]) => (
        <Card key={structureId}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {items[0].structureName}
              <span className="ml-2 text-sm font-normal text-muted-foreground">({structureId})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {items.map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <Link href={`/jobs/${jobId}/drawings/${d.id}`} className="hover:underline text-foreground">
                    {d.filename}
                  </Link>
                  <span className="text-muted-foreground">{d.pageCount}p</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
