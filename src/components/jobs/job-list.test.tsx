import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JobList } from './job-list'

const mockJobs = [
  {
    id: '1',
    projectNumber: 'PRJ-001',
    title: 'Refinery Turnaround',
    client: 'Ops Team',
    status: 'draft' as const,
    startDate: '2026-07-01T00:00:00.000Z',
    durationWeeks: 8,
    _count: { drawings: 3 },
  },
]

describe('JobList', () => {
  it('renders job data in a table row', () => {
    render(<JobList jobs={mockJobs} />)
    expect(screen.getByText('PRJ-001')).toBeInTheDocument()
    expect(screen.getByText('Refinery Turnaround')).toBeInTheDocument()
    expect(screen.getByText('Ops Team')).toBeInTheDocument()
    expect(screen.getByText('8w')).toBeInTheDocument()
  })

  it('shows empty state when no jobs', () => {
    render(<JobList jobs={[]} />)
    expect(screen.getByText(/no jobs/i)).toBeInTheDocument()
  })
})
