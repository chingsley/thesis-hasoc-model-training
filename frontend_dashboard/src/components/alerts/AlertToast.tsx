import { useDashboardStore } from '@/lib/store/dashboard'
import { useEffect } from 'react'
import { toast } from 'sonner'

export function AlertToast() {
  const alerts = useDashboardStore((s) => s.alerts)
  const unreadAlerts = alerts.filter((a) => !a.read).slice(0, 3)

  useEffect(() => {
    unreadAlerts.forEach((alert) => {
      const method = alert.severity === 'high' ? 'error' : alert.severity === 'medium' ? 'warning' : 'info'
      toast[method](alert.message, {
        description: new Date(alert.timestamp).toLocaleString(),
        duration: 6000,
      })
    })
  }, [unreadAlerts.map((a) => a.id).join(',')])

  return null
}
