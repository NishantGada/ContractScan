import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useVendors } from '@/hooks/useVendors'
import { useContracts, type Contract } from '@/hooks/useContracts'
import { Sidebar } from '@/components/layout/Sidebar'
import { ContractUpload } from '@/components/contracts/ContractUpload'
import { ContractList } from '@/components/contracts/ContractList'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

export default function VendorDetailPage() {
  const { vendorId = '' } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const { vendors, loading: vendorsLoading } = useVendors()
  const vendor = vendors.find((v) => v.id === vendorId) ?? null

  const {
    contracts,
    loading: contractsLoading,
    error,
    clauseRisks,
    uploadContract,
    deleteContract,
    analyzeContract,
    loadAnalysis,
  } = useContracts(vendorId)

  const [pendingDelete, setPendingDelete] = useState<Contract | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteContract(pendingDelete.id)
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary font-display text-lg font-semibold text-primary-foreground">
              C
            </div>
            <span className="font-display text-xl font-semibold text-text-primary">
              ContractScan
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-text-muted">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl">
        <Sidebar
          vendors={vendors}
          activeVendorId={vendorId}
          onSelect={(v) => navigate(`/vendors/${v.id}`)}
        />

        <main className="flex-1 px-6 py-10">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            All vendors
          </Link>

          {vendorsLoading && !vendor ? (
            <p className="mt-8 text-sm text-text-muted">Loading vendor…</p>
          ) : !vendor ? (
            <div className="mt-8 rounded-lg border border-dashed border-border bg-surface px-6 py-16 text-center">
              <h1 className="font-display text-xl font-medium text-text-primary">
                Vendor not found
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-text-muted">
                This vendor doesn’t exist or isn’t yours.
              </p>
              <Button className="mt-6" onClick={() => navigate('/')}>
                Back to dashboard
              </Button>
            </div>
          ) : (
            <>
              <div className="mt-6">
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
                    {vendor.name}
                  </h1>
                  {vendor.category && (
                    <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 font-mono text-xs text-text-muted">
                      {vendor.category}
                    </span>
                  )}
                </div>
                {vendor.website && (
                  <a
                    href={vendor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>{vendor.website.replace(/^https?:\/\//, '')}</span>
                  </a>
                )}
              </div>

              <section className="mt-8">
                <h2 className="font-display text-lg font-semibold text-text-primary">
                  Upload a contract
                </h2>
                <div className="mt-4">
                  <ContractUpload onUpload={uploadContract} />
                </div>
              </section>

              <section className="mt-10">
                <h2 className="font-display text-lg font-semibold text-text-primary">
                  Contracts
                </h2>
                <div className="mt-4">
                  {contractsLoading ? (
                    <p className="text-sm text-text-muted">Loading contracts…</p>
                  ) : error ? (
                    <p role="alert" className="text-sm text-risk-high">
                      {error}
                    </p>
                  ) : (
                    <ContractList
                      contracts={contracts}
                      clauseRisks={clauseRisks}
                      onDelete={setPendingDelete}
                      onAnalyze={analyzeContract}
                      onExpand={loadAnalysis}
                    />
                  )}
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      <Dialog
        open={pendingDelete !== null}
        onClose={() => !deleting && setPendingDelete(null)}
        title="Delete contract"
        description={`Delete “${pendingDelete?.filename}”? This removes the file and its analysis, and cannot be undone.`}
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
