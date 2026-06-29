import { describe, it, expect } from 'vitest'
import { computeWeeklyDemand } from '@/lib/resource-histogram-utils'
import type { GanttJob } from '@/components/schedule/gantt-chart'

const week1 = new Date('2026-07-06')
const week2 = new Date('2026-07-13')
const week3 = new Date('2026-07-20')

const mockJob: GanttJob = {
  jobId: 'job-1',
  title: 'Test Job',
  projectNumber: 'P001',
  structures: [
    {
      structureId: 'S01',
      structureName: 'Structure 1',
      drawingId: 'draw-1',
      phases: [
        {
          id: 'phase-1',
          jobId: 'job-1',
          type: 'erect',
          structureId: 'S01',
          startDate: '2026-07-06T00:00:00.000Z',
          endDate: '2026-07-19T00:00:00.000Z', // 2 weeks
          manhoursTotal: 200,
        },
      ],
    },
  ],
}

describe('computeWeeklyDemand', () => {
  it('distributes manhours evenly across phase weeks', () => {
    const weeks = [week1, week2, week3]
    const demand = computeWeeklyDemand([mockJob], weeks)
    // Phase spans weeks 0 and 1 (2 weeks) → 100 hrs each
    const w0 = demand.find(d => d.weekStart.getTime() === week1.getTime())
    const w1 = demand.find(d => d.weekStart.getTime() === week2.getTime())
    const w2 = demand.find(d => d.weekStart.getTime() === week3.getTime())
    expect(w0?.byJob['job-1']).toBeCloseTo(100, 0)
    expect(w1?.byJob['job-1']).toBeCloseTo(100, 0)
    expect(w2?.byJob['job-1']).toBeUndefined() // phase doesn't reach week 3
  })

  it('returns 0 totalManhours for weeks with no phases', () => {
    const demand = computeWeeklyDemand([mockJob], [week3])
    expect(demand[0].totalManhours).toBe(0)
  })

  it('sums across multiple jobs', () => {
    const job2: GanttJob = {
      ...mockJob,
      jobId: 'job-2',
      projectNumber: 'P002',
      structures: [
        {
          ...mockJob.structures[0],
          drawingId: 'draw-2',
          phases: [
            { ...mockJob.structures[0].phases[0], id: 'phase-2', jobId: 'job-2', manhoursTotal: 100 },
          ],
        },
      ],
    }
    const demand = computeWeeklyDemand([mockJob, job2], [week1, week2])
    const w0 = demand.find(d => d.weekStart.getTime() === week1.getTime())
    expect(w0?.totalManhours).toBeCloseTo(150, 0) // 100 + 50
  })
})
