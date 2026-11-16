import { cn } from '@/lib/utils'

/**
 * Small tag on a plain-language card that names the Technical-view component showing the same
 * measure, so the two views can be matched.
 */
export function TechnicalName({ children, className }: { children: string; className?: string }) {
  return (
    <p
      className={cn(
        'mt-1.5 w-fit rounded-[4px] bg-[var(--hg-canvas)] px-2 py-1 text-xs text-[var(--hg-muted)]',
        className,
      )}
    >
      In the Technical view: <span className="font-semibold text-[var(--hg-ink)]">{children}</span>
    </p>
  )
}
