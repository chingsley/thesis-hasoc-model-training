import { VIEW_MODES, useViewModeStore } from '@/lib/store/view-mode'
import { cn } from '@/lib/utils'

/**
 * Plain language | Technical switch. It changes the shared dashboard setting, so the other
 * pages follow.
 */
export function ViewModeToggle({ className }: { className?: string }) {
  const viewMode = useViewModeStore((s) => s.viewMode)
  const setViewMode = useViewModeStore((s) => s.setViewMode)

  return (
    <div
      role="group"
      aria-label="Choose how this page is shown"
      className={cn(
        'inline-flex w-fit shrink-0 items-center rounded-[4px] border border-[var(--hg-border)] bg-[var(--hg-canvas)] p-0.5',
        className,
      )}
    >
      {VIEW_MODES.map((mode) => {
        const active = viewMode === mode.value
        return (
          <button
            key={mode.value}
            type="button"
            aria-pressed={active}
            title={mode.title}
            onClick={() => setViewMode(mode.value)}
            className={cn(
              'rounded-[4px] px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
              'focus-visible:ring-2 focus-visible:ring-[var(--hg-brand)]/30 focus-visible:outline-none',
              active
                ? 'bg-white text-[var(--hg-ink)] shadow-sm'
                : 'text-[var(--hg-muted)] hover:bg-[var(--hg-soft)] hover:text-black',
            )}
          >
            {mode.label}
          </button>
        )
      })}
    </div>
  )
}
