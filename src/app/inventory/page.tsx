import InventoryPanel from '@/components/inventory/inventory-panel'
export default function InventoryPage() {
  return (
    <div className="p-6 space-y-6 overflow-auto h-full max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Inventory & Logistics</h1>
        <p className="text-sm text-muted-foreground">Yard stock vs reserved for jobs — local demo, sync to ERP next</p>
      </div>
      <InventoryPanel />
    </div>
  )
}
