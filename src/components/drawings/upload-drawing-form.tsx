'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function UploadDrawingForm({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const res = await fetch(`/api/jobs/${jobId}/drawings`, {
      method: 'POST',
      body: formData,
    })
    if (res.ok) {
      router.refresh()
      e.currentTarget.reset()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
      <div className="space-y-1">
        <Label htmlFor="structureId">Structure ID</Label>
        <Input id="structureId" name="structureId" placeholder="STR-01" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="structureName">Structure Name</Label>
        <Input id="structureName" name="structureName" placeholder="Tank A" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="file">GA Drawing (PDF)</Label>
        <Input id="file" name="file" type="file" accept=".pdf" required />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? 'Uploading…' : 'Upload Drawing'}
      </Button>
    </form>
  )
}
