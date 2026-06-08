import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useVendors } from '@/hooks/useVendors'
import {
  useContracts,
  type Contract,
  type ContractStatus,
  type ContractType,
} from '@/hooks/useContracts'
import { useVendorRisk } from '@/hooks/useVendorRisk'
import { Sidebar } from '@/components/layout/Sidebar'
import { ContractUpload } from '@/components/contracts/ContractUpload'
import { ContractList } from '@/components/contracts/ContractList'
import { RiskSummaryBar } from '@/components/analysis/RiskSummaryBar'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'

export default function VendorDetailPage() {
  const { vendorId = '' } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { toast } = useToast()

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

  const { summary, refetch: refetchRisk } = useVendorRisk(vendorId)

  // The risk summary is a server-side roll-up that doesn't update itself, so
  // refetch it whenever a contract is added, removed, or finishes analysis. The
  // signature captures exactly those transitions; the ref skips the first run so
  // the hook's own initial fetch isn't immediately duplicated.
  const analysisSignature = contracts
    .map((c) => `${c.id}:${c.status}:${c.analyzed_at ?? ''}`)
    .join('|')
  const prevSignatureRef = useRef<string | null>(null)
  useEffect(() => {
    if (prevSignatureRef.current === null) {
      prevSignatureRef.current = analysisSignature
      return
    }
    if (prevSignatureRef.current !== analysisSignature) {
      prevSignatureRef.current = analysisSignature
      void refetchRisk()
    }
  }, [analysisSignature, refetchRisk])

  // Toast when a contract's analysis settles. We diff each contract's status
  // against its previous value so a transition into done/failed fires exactly
  // once — first-seen contracts (no prior status) are skipped, so the initial
  // load and freshly-uploaded contracts never trigger a spurious toast.
  const prevStatusesRef = useRef<Record<string, ContractStatus>>({})
  useEffect(() => {
    const prev = prevStatusesRef.current
    for (const c of contracts) {
      const before = prev[c.id]
      if (before && before !== c.status) {
        if (c.status === 'done') {
          toast({
            variant: 'success',
            title: 'Analysis complete',
            description: `“${c.filename}” has been analyzed.`,
          })
        } else if (c.status === 'failed') {
          toast({
            variant: 'error',
            title: 'Analysis failed',
            description: `Couldn’t analyze “${c.filename}”. You can retry from its card.`,
          })
        }
      }
    }
    prevStatusesRef.current = Object.fromEntries(contracts.map((c) => [c.id, c.status]))
  }, [contracts, toast])

  const [pendingDelete, setPendingDelete] = useState<Contract | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleUpload(input: { file: File; contractType: ContractType | null }) {
    // ContractUpload shows its own inline error if this throws, so only toast on success.
    const created = await uploadContract(input)
    toast({
      variant: 'success',
      title: 'Contract uploaded',
      description: 'Analysis has started — risks will appear when it finishes.',
    })
    return created
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const filename = pendingDelete.filename
    setDeleting(true)
    try {
      await deleteContract(pendingDelete.id)
      setPendingDelete(null)
      toast({ variant: 'success', title: 'Contract deleted', description: `“${filename}” was removed.` })
    } catch {
      toast({ variant: 'error', title: 'Could not delete contract', description: 'Please try again.' })
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
            <div className="mt-8 space-y-8" aria-busy="true" aria-label="Loading vendor">
              <div className="space-y-3">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
            </div>
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

              {summary && (
                <RiskSummaryBar
                  className="mt-8"
                  high={summary.high}
                  medium={summary.medium}
                  low={summary.low}
                />
              )}

              <section className="mt-8">
                <h2 className="font-display text-lg font-semibold text-text-primary">
                  Upload a contract
                </h2>
                <div className="mt-4">
                  <ContractUpload onUpload={handleUpload} />
                </div>
              </section>

              <section className="mt-10">
                <h2 className="font-display text-lg font-semibold text-text-primary">
                  Contracts
                </h2>
                <div className="mt-4">
                  {contractsLoading ? (
                    <ul
                      className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface"
                      aria-busy="true"
                      aria-label="Loading contracts"
                    >
                      {Array.from({ length: 3 }).map((_, i) => (
                        <li key={i} className="flex items-center gap-4 px-5 py-4">
                          <Skeleton className="h-5 w-5 shrink-0 rounded" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-56" />
                            <Skeleton className="h-3 w-40" />
                          </div>
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </li>
                      ))}
                    </ul>
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
