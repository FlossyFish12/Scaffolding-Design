import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ComplianceSummary from '../compliance-summary'

const zones = [
  { id: 'z1', label: 'Zone A', scaffoldType: 'independent', accessType: 'ground', loadingClass: 'light', heightM: 6, perimeterM: 10, areaM2: 20 },
  { id: 'z2', label: 'Zone B', scaffoldType: 'birdcage', accessType: 'ground', loadingClass: 'heavy', heightM: 12, perimeterM: 20, areaM2: 80 },
]

describe('ComplianceSummary', () => {
  it('renders zone labels', () => {
    render(<ComplianceSummary zones={zones} />)
    expect(screen.getByText(/Zone A/)).toBeInTheDocument()
    expect(screen.getByText(/Zone B/)).toBeInTheDocument()
  })

  it('shows compliance summary count', () => {
    render(<ComplianceSummary zones={zones} />)
    expect(screen.getByText(/zones compliant/)).toBeInTheDocument()
  })

  it('shows empty when no zones', () => {
    const { container } = render(<ComplianceSummary zones={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
