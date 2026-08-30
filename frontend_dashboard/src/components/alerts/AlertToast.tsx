import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useDashboardStore } from '@/lib/store/dashboard'

/** Surfaces newly arrived unread alerts once (layout-mounted). */
export function AlertToast() {
  const alerts = useDashboardStore((s) => s.alerts)
  const toastedIds = useRef(new Set<string>())

  useEffect(() => {
    const unread = alerts.filter((a) => !a.read)
    const fresh = unread.filter((a) => !toastedIds.current.has(a.id)).slice(0, 3)
    fresh.forEach((alert) => {
      toastedIds.current.add(alert.id)
      const method =
        alert.severity === 'high' ? 'error' : alert.severity === 'medium' ? 'warning' : 'info'
      toast[method](alert.message, {
        description: new Date(alert.timestamp).toLocaleString(),
        duration: 6000,
      })
    })
  }, [alerts])

  return null
}
