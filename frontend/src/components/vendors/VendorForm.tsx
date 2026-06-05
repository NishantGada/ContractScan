import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  VENDOR_CATEGORIES,
  type Vendor,
  type VendorCategory,
  type VendorInput,
} from '@/hooks/useVendors'

interface VendorFormProps {
  onClose: () => void
  /** When provided, the form edits this vendor; otherwise it creates a new one. */
  vendor?: Vendor | null
  onSubmit: (input: VendorInput) => Promise<void>
}

/**
 * Modal form shared by the create and edit flows.
 *
 * Mounted only while open (see DashboardPage), so initial field values come
 * straight from the `vendor` prop — no reset effect needed, and every open
 * starts from a clean slate.
 */
export function VendorForm({ onClose, vendor, onSubmit }: VendorFormProps) {
  const isEdit = Boolean(vendor)

  const [name, setName] = useState(vendor?.name ?? '')
  const [website, setWebsite] = useState(vendor?.website ?? '')
  const [category, setCategory] = useState<VendorCategory | ''>(vendor?.category ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Vendor name is required.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        website: website.trim() || null,
        category: category || null,
      })
      onClose()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEdit ? 'Edit vendor' : 'Add vendor'}
      description={
        isEdit
          ? 'Update this vendor’s details.'
          : 'Add a vendor to start tracking their contract risk.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="vendor-name">Name</Label>
          <Input
            id="vendor-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Corp"
            autoFocus
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vendor-website">Website</Label>
          <Input
            id="vendor-website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://acme.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vendor-category">Category</Label>
          <Select
            id="vendor-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as VendorCategory | '')}
          >
            <option value="">Uncategorized</option>
            {VENDOR_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        {error && (
          <p role="alert" className="text-sm text-risk-high">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add vendor'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
