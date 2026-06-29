import { CreateJobForm } from '@/components/jobs/create-job-form'

export default function NewJobPage() {
  return (
    <div className="p-6 overflow-auto h-full space-y-6">
      <h1 className="text-2xl font-semibold">New Job</h1>
      <CreateJobForm />
    </div>
  )
}
