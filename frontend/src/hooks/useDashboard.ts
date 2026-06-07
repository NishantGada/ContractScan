import { useCallback, useEffect, useState } from 'react'

import { api } from '@/lib/api'
import type { Vendor } from '@/hooks/useVendors'
import type { RiskSeverity } from '@/hooks/useContracts'

export interface DashboardVendor {
  vendor: Vendor
  total_contracts: number
  high: number
  medium: number
  low: number
  total_risks: number
  overall: RiskSeverity
  risk_score: number
}

export interface DashboardTotals {
  total_vendors: number
  total_contracts: number
  high_risk_clauses: number
}

export interface Dashboard {
  totals: DashboardTotals
  vendors: DashboardVendor[]
}

interface UseDashboardResult {
  dashboard: Dashboard | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Fetches the portfolio overview (`GET /dashboard`): account-wide totals plus
 * every vendor with its rolled-up risk, already ranked highest-risk first by the
 * backend. One request covers the whole dashboard — there's no per-vendor fetch.
 * Exposes `refetch` so the page can refresh after a vendor is added or removed.
 * The JWT is attached by the axios interceptor — this hook never touches identity.
 */
export function useDashboard(): UseDashboardResult {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      const { data } = await api.get<Dashboard>('/dashboard')
      setDashboard(data)
      setError(null)
    } catch {
      setError('Could not load the dashboard. Please try again.')
    }
  }, [])

  useEffect(() => {
    // Load once on mount. State is only touched in the async continuations
    // (never synchronously in the effect body) to avoid cascading renders.
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const { data } = await api.get<Dashboard>('/dashboard')
        if (active) {
          setDashboard(data)
          setError(null)
        }
      } catch {
        if (active) setError('Could not load the dashboard. Please try again.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  return { dashboard, loading, error, refetch }
}
