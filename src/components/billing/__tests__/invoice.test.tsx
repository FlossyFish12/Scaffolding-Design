import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Invoice from '../invoice'

const lines = [
  { description: 'Erect', quantity: 10, unitManhours: 1.5, structure: 'Tank A', zone: 'Zone 1' },
  { description: 'Dismantle', quantity: 10, unitManhours: 1.0, structure: 'Tank A', zone: 'Zone 1' },
]

describe('Invoice', () => {
  it('renders grand total', () => {
    render(<Invoice lines={lines} jobRef="TEST-001" />)
    // 10*1.5=15 + 10*1.0=10 => 25 hrs *45 =1125 AED subtotal, +5% VAT =1181.25
    expect(screen.getByText(/Grand Total/)).toBeInTheDocument()
    expect(screen.getByText(/1,181/)).toBeInTheDocument()
  })

  it('shows line items', () => {
    render(<Invoice lines={lines} jobRef="TEST-001" />)
    expect(screen.getByText(/Erect/)).toBeInTheDocument()
  })
})
