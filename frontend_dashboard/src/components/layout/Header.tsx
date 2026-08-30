import { Bell, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataSourceBadge } from '@/components/ui/data-source-badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDashboardStore } from '@/lib/store/dashboard'
import type { Language } from '@/lib/types'
import { cn } from '@/lib/utils'

interface HeaderProps {
  onMenuClick: () => void
}

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'igbo', label: 'Igbo' },
  { value: 'yoruba', label: 'Yoruba' },
]

export function Header({ onMenuClick }: HeaderProps) {
  const language = useDashboardStore((s) => s.language)
  const setLanguage = useDashboardStore((s) => s.setLanguage)
  const unreadAlertCount = useDashboardStore((s) => s.unreadAlertCount)

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--hg-border)] bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
          <DataSourceBadge />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Select
            value={language}
            onValueChange={(value) => {
              if (value) setLanguage(value as Language)
            }}
            items={LANGUAGES}
          >
            <SelectTrigger
              size="sm"
              aria-label="Language"
              className={cn(
                'w-36 rounded-[4px] border-[var(--hg-secondary)]/40 bg-white text-xs font-medium text-[var(--hg-secondary)]',
                'data-[size=sm]:h-8 data-[size=sm]:rounded-[4px]',
                'hover:border-[var(--hg-secondary)] hover:bg-[var(--hg-secondary)]/5',
                'focus-visible:border-[var(--hg-secondary)] focus-visible:ring-[var(--hg-secondary)]/25',
                'data-popup-open:border-[var(--hg-secondary)] data-popup-open:bg-[var(--hg-secondary)]/5',
                '[&_svg]:text-[var(--hg-secondary)]',
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              align="end"
              className="w-36 min-w-36 rounded-[4px] border border-[var(--hg-border)] bg-white p-1 shadow-[var(--hg-shadow)] ring-0"
            >
              {LANGUAGES.map((l) => (
                <SelectItem
                  key={l.value}
                  value={l.value}
                  className={cn(
                    'min-h-8 rounded-[4px] py-0 text-xs text-[var(--hg-ink)]',
                    'data-highlighted:bg-[var(--hg-secondary)] data-highlighted:text-white',
                    'focus:bg-[var(--hg-secondary)] focus:text-white',
                    'data-highlighted:[&_svg]:text-white focus:[&_svg]:text-white',
                  )}
                >
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="ghost" size="icon" className="relative text-[var(--hg-muted)]">
            <Bell className="h-5 w-5" />
            {unreadAlertCount > 0 && (
              <span
                aria-label={`${unreadAlertCount} unread alerts`}
                className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--hg-secondary)] px-1 text-[11px] font-bold leading-none text-white tabular-nums shadow-sm ring-2 ring-white"
              >
                {unreadAlertCount > 99 ? '99+' : unreadAlertCount}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  )
}
