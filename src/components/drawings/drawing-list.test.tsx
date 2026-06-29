import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DrawingList } from './drawing-list'

const mockDrawings = [
  { id: 'd1', structureId: 'STR-01', structureName: 'Tank A', filename: 'ga-tank-a.pdf', blobUrl: 'https://blob.example.com/a.pdf', pageCount: 2, createdAt: new Date().toISOString() },
  { id: 'd2', structureId: 'STR-01', structureName: 'Tank A', filename: 'ga-tank-a-rev2.pdf', blobUrl: 'https://blob.example.com/b.pdf', pageCount: 1, createdAt: new Date().toISOString() },
  { id: 'd3', structureId: 'STR-02', structureName: 'Column C3', filename: 'ga-col-c3.pdf', blobUrl: 'https://blob.example.com/c.pdf', pageCount: 3, createdAt: new Date().toISOString() },
]

describe('DrawingList', () => {
  it('renders structure group headings', () => {
    render(<DrawingList drawings={mockDrawings} jobId="j1" />)
    expect(screen.getByText('Tank A')).toBeInTheDocument()
    expect(screen.getByText('Column C3')).toBeInTheDocument()
  })

  it('renders all drawing filenames', () => {
    render(<DrawingList drawings={mockDrawings} jobId="j1" />)
    expect(screen.getByText('ga-tank-a.pdf')).toBeInTheDocument()
    expect(screen.getByText('ga-tank-a-rev2.pdf')).toBeInTheDocument()
    expect(screen.getByText('ga-col-c3.pdf')).toBeInTheDocument()
  })

  it('shows empty state when no drawings', () => {
    render(<DrawingList drawings={[]} jobId="j1" />)
    expect(screen.getByText(/no drawings/i)).toBeInTheDocument()
  })
})
