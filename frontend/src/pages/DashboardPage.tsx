import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useVendors, type Vendor, type VendorInput } from '@/hooks/useVendors'
import { useDashboard } from '@/hooks/useDashboard'
import { Sidebar } from '@/components/layout/Sidebar'
import { VendorRiskRow } from '@/components/vendors/VendorRiskRow'
import { VendorForm } from '@/components/vendors/VendorForm'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

// Headline stats shown across the top of the portfolio overview.
const STATS = [
  { key: 'total_vendors', label: 'Vendors' },
  { key: 'total_contracts', label: 'Contracts' },
  { key: 'high_risk_clauses', label: 'High-risk clauses' },
] as const

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  // useDashboard drives the ranked portfolio view; useVendors owns the sidebar
  // list and the create/edit/delete mutations. After any mutation we refetch the
  // dashboard so risk rankings and totals stay in sync.
  const { vendors, createVendor, updateVendor, deleteVendor } = useVendors()
  const { dashboard, loading, error, refetch } = useDashboard()

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
    await refetch()
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteVendor(pendingDelete.id)
      await refetch()
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const totals = dashboard?.totals
  const rankedVendors = dashboard?.vendors ?? []

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
                Portfolio
              </h1>
              <p className="mt-1 text-text-muted">
                Your vendors ranked by contract risk — highest first.
              </p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add vendor
            </Button>
          </div>

          {/* Headline stats */}
          <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {STATS.map(({ key, label }) => (
              <div
                key={key}
                className="rounded-lg border border-border bg-surface px-5 py-4"
              >
                <p className="font-mono text-xs uppercase tracking-wide text-text-muted">
                  {label}
                </p>
                <p className="mt-1 font-display text-3xl font-semibold text-text-primary">
                  {totals ? totals[key] : '—'}
                </p>
              </div>
            ))}
          </section>

          <section className="mt-8">
            {loading ? (
              <p className="text-sm text-text-muted">Loading portfolio…</p>
            ) : error ? (
              <p role="alert" className="text-sm text-risk-high">
                {error}
              </p>
            ) : rankedVendors.length === 0 ? (
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
              <div className="flex flex-col gap-4">
                {rankedVendors.map((entry) => (
                  <VendorRiskRow
                    key={entry.vendor.id}
                    entry={entry}
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
