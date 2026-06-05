import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useVendors, type Vendor, type VendorInput } from '@/hooks/useVendors'
import { Sidebar } from '@/components/layout/Sidebar'
import { VendorCard } from '@/components/vendors/VendorCard'
import { VendorForm } from '@/components/vendors/VendorForm'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { vendors, loading, error, createVendor, updateVendor, deleteVendor } = useVendors()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Vendor | null>(null)
  const [deleting, setDeleting] = useState(false)

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(vendor: Vendor) {
    setEditing(vendor)
    setFormOpen(true)
  }

  async function handleSubmit(input: VendorInput) {
    if (editing) {
      await updateVendor(editing.id, input)
    } else {
      await createVendor(input)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteVendor(pendingDelete.id)
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary font-display text-lg font-semibold text-primary-foreground">
              C
            </div>
            <span className="font-display text-xl font-semibold text-text-primary">
              ContractScan
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-text-muted">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl">
        <Sidebar vendors={vendors} onSelect={(v) => navigate(`/vendors/${v.id}`)} />

        <main className="flex-1 px-6 py-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
                Vendors
              </h1>
              <p className="mt-1 text-text-muted">
                Track the vendors whose contracts you want to analyze.
              </p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add vendor
            </Button>
          </div>

          <section className="mt-8">
            {loading ? (
              <p className="text-sm text-text-muted">Loading vendors…</p>
            ) : error ? (
              <p role="alert" className="text-sm text-risk-high">
                {error}
              </p>
            ) : vendors.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-16 text-center">
                <h2 className="font-display text-xl font-medium text-text-primary">
                  No vendors yet
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-text-muted">
                  Add your first vendor to start uploading and analyzing their
                  contracts.
                </p>
                <Button className="mt-6" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add vendor
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {vendors.map((vendor) => (
                  <VendorCard
                    key={vendor.id}
                    vendor={vendor}
                    onEdit={openEdit}
                    onDelete={setPendingDelete}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      {formOpen && (
        <VendorForm
          vendor={editing}
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
        />
      )}

      <Dialog
        open={pendingDelete !== null}
        onClose={() => !deleting && setPendingDelete(null)}
        title="Delete vendor"
        description={`Delete “${pendingDelete?.name}”? This also removes its contracts and cannot be undone.`}
      >
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => setPendingDelete(null)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            className="bg-risk-high text-primary-foreground hover:bg-risk-high/90"
            onClick={confirmDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
