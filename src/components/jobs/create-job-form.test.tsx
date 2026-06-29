import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateJobForm } from './create-job-form'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

global.fetch = vi.fn()

describe('CreateJobForm', () => {
  it('renders all required fields', () => {
    render(<CreateJobForm />)
    expect(screen.getByLabelText(/project number/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/client/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/duration/i)).toBeInTheDocument()
  })

  it('submits to POST /api/jobs and redirects on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'new-id' }),
    } as Response)

    render(<CreateJobForm />)

    fireEvent.change(screen.getByLabelText(/project number/i), { target: { value: 'PRJ-001' } })
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Test Job' } })
    fireEvent.change(screen.getByLabelText(/client/i), { target: { value: 'Ops' } })
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-07-01' } })
    fireEvent.change(screen.getByLabelText(/duration/i), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: /create job/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/jobs', expect.objectContaining({ method: 'POST' }))
      expect(mockPush).toHaveBeenCalledWith('/jobs/new-id')
    })
  })
})
