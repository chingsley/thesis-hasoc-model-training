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

/** Soft S-curve: open left 20% (1/5), then a tighter curve into the white bar. */
const HEADER_CUTOUT_PATH =
  'M0.20,0 C0.22,0.18 0.23,0.42 0.24,0.62 C0.25,0.82 0.26,0.94 0.28,1 L1,1 L1,0 Z'

export function Header({ onMenuClick }: HeaderProps) {
  const language = useDashboardStore((s) => s.language)
  const setLanguage = useDashboardStore((s) => s.setLanguage)
  const unreadAlertCount = useDashboardStore((s) => s.unreadAlertCount)

  return (
    <header className="sticky top-0 z-30 bg-[#eaebf4]">
      <div className="relative h-16 w-full">
        <svg width={0} height={0} className="absolute" aria-hidden>
          <defs>
            <clipPath id="hg-header-cutout" clipPathUnits="objectBoundingBox">
              <path d={HEADER_CUTOUT_PATH} />
            </clipPath>
          </defs>
        </svg>

        {/* White bar with curved left cutout (1/5 open to canvas) */}
        <div
          className="absolute inset-0 border-b border-[var(--hg-border)] bg-white"
          style={{ clipPath: 'url(#hg-header-cutout)' }}
        />

        {/* Curve edge stroke (follows the same S-path) */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 64"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M20,0 C22,11.5 23,26.9 24,39.7 C25,52.5 26,60.2 28,64"
            fill="none"
            stroke="var(--hg-border)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="relative z-10 flex h-full w-full items-center justify-between">
          <div className="flex w-1/5 items-center gap-3 px-4 md:px-6 lg:px-8">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
              <Menu className="h-5 w-5" />
            </Button>
            <DataSourceBadge />
          </div>

          <div className="flex flex-1 items-center justify-end gap-2 px-4 md:px-6 lg:px-8">
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
                  'w-36 rounded-[4px] border-[var(--hg-border)] bg-white text-xs font-medium text-black',
                  'data-[size=sm]:h-8 data-[size=sm]:rounded-[4px]',
                  'hover:border-[var(--hg-muted)] hover:bg-[var(--hg-soft)]',
                  'focus-visible:border-[#625885] focus-visible:ring-[#625885]/25',
                  'data-popup-open:border-[#625885] data-popup-open:bg-[var(--hg-soft)]',
                  '[&_svg]:text-[var(--hg-muted)]',
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
                      'min-h-8 rounded-[4px] py-0 text-xs text-black',
                      'data-highlighted:bg-[var(--hg-soft)] data-highlighted:text-black',
                      'focus:bg-[var(--hg-soft)] focus:text-black',
                      'data-[selected]:bg-[var(--hg-soft-selected)] data-[selected]:text-black',
                      'data-[selected]:data-highlighted:bg-[var(--hg-soft-selected)]',
                      'data-highlighted:[&_svg]:text-black focus:[&_svg]:text-black data-[selected]:[&_svg]:text-black',
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
      </div>
    </header>
  )
}
