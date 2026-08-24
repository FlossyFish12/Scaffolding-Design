import SafetyChecklist from '@/components/safety/checklist'
export default function GlobalSafetyPage() {
  return (
    <div className="p-6 space-y-6 overflow-auto h-full max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Safety Checklist — Standalone</h1>
        <p className="text-sm text-muted-foreground">TG20 / EN12811 pre-handover checks — saved locally, export CSV for records</p>
      </div>
      <SafetyChecklist title="Global Checklist" />
    </div>
  )
}
