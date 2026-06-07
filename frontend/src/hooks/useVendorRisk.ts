import { useCallback, useEffect, useState } from 'react'

import { api } from '@/lib/api'
import type { ClauseRisk, RiskSeverity } from '@/hooks/useContracts'

export interface VendorRiskSummary {
  vendor_id: string
  total_contracts: number
  high: number
  medium: number
  low: number
  total_risks: number
  overall: RiskSeverity
  clause_risks: ClauseRisk[]
}

interface UseVendorRiskResult {
  summary: VendorRiskSummary | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Fetches a vendor's rolled-up risk summary (`GET /vendors/{id}/risk-summary`):
 * per-severity counts, an overall level, and every clause risk across the
 * vendor's contracts. Exposes `refetch` so callers can refresh once analysis
 * finishes (the summary doesn't update itself). The JWT is attached by the axios
 * interceptor — this hook never touches identity.
 */
export function useVendorRisk(vendorId: string): UseVendorRiskResult {
  const [summary, setSummary] = useState<VendorRiskSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      const { data } = await api.get<VendorRiskSummary>(
        `/vendors/${vendorId}/risk-summary`,
      )
      setSummary(data)
      setError(null)
    } catch {
      setError('Could not load risk summary.')
    }
  }, [vendorId])

  useEffect(() => {
    // Load whenever the vendor changes. All state is touched inside the async
    // helper (never synchronously in the effect body) to avoid cascading renders.
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const { data } = await api.get<VendorRiskSummary>(
          `/vendors/${vendorId}/risk-summary`,
        )
        if (active) {
          setSummary(data)
          setError(null)
        }
      } catch {
        if (active) setError('Could not load risk summary.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [vendorId])

  return { summary, loading, error, refetch }
}
