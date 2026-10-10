import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Building2, Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fetchOrganizations, setActiveOrganization } from '@/lib/api/client'
import { useAuthStore } from '@/lib/store/auth'
import type { OrganizationInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

const triggerClass = cn(
  'max-w-[220px] rounded-[4px] border-[var(--hg-border)] bg-white text-xs font-medium text-black',
  'data-[size=sm]:h-8 data-[size=sm]:rounded-[4px]',
  'hover:border-[var(--hg-muted)] hover:bg-[var(--hg-soft)]',
  'focus-visible:border-[var(--hg-brand)] focus-visible:ring-[var(--hg-brand)]/25',
  'data-popup-open:border-[var(--hg-brand)] data-popup-open:bg-[var(--hg-soft)]',
  '[&_svg]:text-[var(--hg-muted)]',
)

export function OrganizationSwitcher() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const setAuth = useAuthStore((s) => s.setAuth)
  const queryClient = useQueryClient()
  const [orgs, setOrgs] = useState<OrganizationInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [switching, setSwitching] = useState(false)

  const loadOrgs = useCallback(async () => {
    if (!user?.is_platform_admin) return
    setLoading(true)
    try {
      setOrgs(await fetchOrganizations())
    } finally {
      setLoading(false)
    }
  }, [user?.is_platform_admin])

  useEffect(() => {
    loadOrgs()
  }, [loadOrgs])

  if (!user?.is_platform_admin) return null

  const value = String(user.organization_id)

  const handleChange = async (next: string | null) => {
    if (!next || !token || next === value) return
    setSwitching(true)
    try {
      const updated = await setActiveOrganization(Number(next))
      setAuth(token, updated)
      await queryClient.invalidateQueries()
    } finally {
      setSwitching(false)
    }
  }

  if (loading && orgs.length === 0) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 px-2 text-xs text-[var(--hg-muted)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Orgs
      </span>
    )
  }

  if (orgs.length === 0) return null

  const orgItems = orgs.map((org) => ({ value: String(org.id), label: org.name }))

  return (
    <Select
      value={value}
      onValueChange={handleChange}
      disabled={switching}
      items={orgItems}
    >
      <SelectTrigger size="sm" aria-label="Active organization" className={triggerClass}>
        <span className="flex min-w-0 items-center gap-1.5">
          {switching ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : (
            <Building2 className="h-3.5 w-3.5 shrink-0" />
          )}
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent
        align="end"
        className="max-h-72 min-w-[220px] rounded-[4px] border border-[var(--hg-border)] bg-white p-1 shadow-[var(--hg-shadow)] ring-0"
      >
        {orgs.map((org) => (
          <SelectItem
            key={org.id}
            value={String(org.id)}
            className={cn(
              'min-h-8 rounded-[4px] py-0 text-xs text-black',
              'data-highlighted:bg-[var(--hg-soft)] data-highlighted:text-black',
              'focus:bg-[var(--hg-soft)] focus:text-black',
              'data-[selected]:bg-[var(--hg-soft-selected)] data-[selected]:text-black',
            )}
          >
            {org.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
