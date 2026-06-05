import { useCallback, useEffect, useState } from 'react'

import { api } from '@/lib/api'

export const VENDOR_CATEGORIES = [
  'SaaS',
  'Legal',
  'Infrastructure',
  'Finance',
  'Other',
] as const

export type VendorCategory = (typeof VENDOR_CATEGORIES)[number]

export interface Vendor {
  id: string
  name: string
  website: string | null
  category: VendorCategory | null
  created_at: string
}

export interface VendorInput {
  name: string
  website?: string | null
  category?: VendorCategory | null
}

interface UseVendorsResult {
  vendors: Vendor[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  createVendor: (input: VendorInput) => Promise<Vendor>
  updateVendor: (id: string, input: VendorInput) => Promise<Vendor>
  deleteVendor: (id: string) => Promise<void>
}

/**
 * Owns the vendor list and the create/update/delete mutations. Mutations update
 * local state optimistically-after-success so the dashboard reflects changes
 * without a full refetch round-trip. The JWT is attached by the axios
 * interceptor in lib/api.ts — this hook never touches identity.
 */
export function useVendors(): UseVendorsResult {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<Vendor[]>('/vendors')
      setVendors(data)
    } catch {
      setError('Could not load vendors. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Load once on mount. State is only touched in the async continuations
    // (never synchronously in the effect body) to avoid cascading renders.
    let active = true
    api
      .get<Vendor[]>('/vendors')
      .then(({ data }) => {
        if (active) setVendors(data)
      })
      .catch(() => {
        if (active) setError('Could not load vendors. Please try again.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const createVendor = useCallback(async (input: VendorInput) => {
    const { data } = await api.post<Vendor>('/vendors', input)
    setVendors((prev) => [data, ...prev])
    return data
  }, [])

  const updateVendor = useCallback(async (id: string, input: VendorInput) => {
    const { data } = await api.patch<Vendor>(`/vendors/${id}`, input)
    setVendors((prev) => prev.map((v) => (v.id === id ? data : v)))
    return data
  }, [])

  const deleteVendor = useCallback(async (id: string) => {
    await api.delete(`/vendors/${id}`)
    setVendors((prev) => prev.filter((v) => v.id !== id))
  }, [])

  return { vendors, loading, error, refetch, createVendor, updateVendor, deleteVendor }
}
