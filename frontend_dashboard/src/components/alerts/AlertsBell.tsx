import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, AlertTriangle, Activity, TrendingUp, Check } from 'lucide-react'
import { Popover } from '@base-ui/react/popover'
import { markAlertRead } from '@/lib/api/client'
import { useDashboardStore } from '@/lib/store/dashboard'
import type { AlertItem } from '@/lib/types'
import { cn } from '@/lib/utils'

const TYPE_META: Record<
  AlertItem['type'],
  { label: string; icon: typeof AlertTriangle }
> = {
  hate_threshold: { label: 'High-confidence hate', icon: AlertTriangle },
  volume_spike: { label: 'Volume spike', icon: Activity },
  model_drift: { label: 'Model drift', icon: TrendingUp },
}

function severityClass(severity: AlertItem['severity']) {
  if (severity === 'high') return 'bg-[var(--hg-secondary)]'
  if (severity === 'medium') return 'bg-amber-500'
  return 'bg-[var(--hg-subtle)]'
}

function AlertRow({
  alert,
  onMarkRead,
  pending,
}: {
  alert: AlertItem
  onMarkRead: (id: string) => void
  pending: boolean
}) {
  const meta = TYPE_META[alert.type]
  const Icon = meta.icon

  return (
    <li
      className={cn(
        'border-b border-[var(--hg-border)] last:border-b-0',
        !alert.read && 'bg-[var(--hg-soft)]/30',
      )}
    >
      <button
        type="button"
        disabled={alert.read || pending}
        onClick={() => onMarkRead(alert.id)}
        className={cn(
          'flex w-full gap-3 px-3 py-3 text-left transition-colors',
          alert.read
            ? 'cursor-default'
            : 'hover:bg-[var(--hg-canvas)] disabled:opacity-60',
        )}
      >
        <span
          className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', severityClass(alert.severity))}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5">
            <Icon className="size-3 shrink-0 text-[var(--hg-muted)]" aria-hidden />
            <span className="text-[10px] font-semibold tracking-wide text-[var(--hg-muted)] uppercase">
              {meta.label}
            </span>
            {!alert.read ? (
              <span className="text-[10px] font-medium text-[var(--hg-brand)]">New</span>
            ) : (
              <Check className="size-3 text-[var(--hg-subtle)]" aria-hidden />
            )}
          </div>
          <p className="text-xs leading-relaxed text-[var(--hg-ink)]">{alert.message}</p>
          <p className="text-[10px] text-[var(--hg-subtle)]">
            {new Date(alert.timestamp).toLocaleString()}
          </p>
        </div>
      </button>
    </li>
  )
}

export function AlertsBell() {
  const alerts = useDashboardStore((s) => s.alerts)
  const unreadAlertCount = useDashboardStore((s) => s.unreadAlertCount)
  const setAlerts = useDashboardStore((s) => s.setAlerts)
  const queryClient = useQueryClient()

  const markRead = useMutation({
    mutationFn: markAlertRead,
    onMutate: async (alertId) => {
      const current = useDashboardStore.getState().alerts
      setAlerts(current.map((a) => (a.id === alertId ? { ...a, read: true } : a)))
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })

  return (
    <Popover.Root>
      <Popover.Trigger
        type="button"
        aria-label={unreadAlertCount > 0 ? `${unreadAlertCount} unread alerts` : 'Alerts'}
        className={cn(
          'relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--hg-muted)] transition-colors',
          'hover:bg-muted hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hg-brand)]/30',
          'data-popup-open:bg-[var(--hg-soft)] data-popup-open:text-[var(--hg-ink)]',
        )}
      >
        <Bell className="h-5 w-5" />
        {unreadAlertCount > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--hg-secondary)] px-1 text-[11px] font-bold leading-none text-white tabular-nums shadow-sm ring-2 ring-white"
          >
            {unreadAlertCount > 99 ? '99+' : unreadAlertCount}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <Popover.Popup
            className={cn(
              'flex w-[360px] max-w-[calc(100vw-2rem)] origin-(--transform-origin) flex-col overflow-hidden rounded-[4px] border border-[var(--hg-border)] bg-white shadow-[var(--hg-shadow)] outline-none',
              'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
              'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--hg-border)] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[var(--hg-ink)]">Alerts</p>
                <p className="mt-0.5 text-xs text-[var(--hg-muted)]">
                  From your recent prediction activity
                </p>
              </div>
              {unreadAlertCount > 0 ? (
                <span className="rounded-[4px] bg-[var(--hg-secondary)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--hg-secondary)] tabular-nums">
                  {unreadAlertCount} new
                </span>
              ) : null}
            </div>

            {alerts.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium text-[var(--hg-ink)]">No alerts yet</p>
                <p className="mt-1 text-xs text-[var(--hg-muted)]">
                  Spikes, high-confidence hate, and drift will show up here.
                </p>
              </div>
            ) : (
              <ul className="max-h-[min(420px,70vh)] overflow-y-auto">
                {alerts.map((alert) => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    pending={markRead.isPending && markRead.variables === alert.id}
                    onMarkRead={(id) => markRead.mutate(id)}
                  />
                ))}
              </ul>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
