'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function CreateJobForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const body = {
      projectNumber: form.get('projectNumber') as string,
      title: form.get('title') as string,
      client: form.get('client') as string,
      startDate: new Date(form.get('startDate') as string).toISOString(),
      durationWeeks: Number(form.get('durationWeeks')),
    }
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const job = await res.json()
      router.push(`/jobs/${job.id}`)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="space-y-1">
        <Label htmlFor="projectNumber">Project Number</Label>
        <Input id="projectNumber" name="projectNumber" placeholder="PRJ-2026-001" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" placeholder="Refinery Turnaround" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="client">Client</Label>
        <Input id="client" name="client" placeholder="Operations Team" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="startDate">Start Date</Label>
        <Input id="startDate" name="startDate" type="date" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="durationWeeks">Duration (weeks)</Label>
        <Input id="durationWeeks" name="durationWeeks" type="number" min="1" required />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? 'Creating…' : 'Create Job'}
      </Button>
    </form>
  )
}
