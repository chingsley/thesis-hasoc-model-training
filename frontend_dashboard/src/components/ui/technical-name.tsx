import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Info icon beside a plain-language heading; on hover, names the matching Technical-view label.
 */
export function TechnicalName({ children, className }: { children: string; className?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center leading-none">
      <Tooltip>
        <TooltipTrigger
          delay={200}
          render={
            <button
              type="button"
              className={cn(
                'inline-flex aspect-square h-[1.15em] w-[1.15em] min-h-5 min-w-5 max-h-7 max-w-7',
                'shrink-0 items-center justify-center rounded-[4px] text-[var(--hg-muted)] transition-colors',
                'hover:bg-[var(--hg-canvas)] hover:text-[var(--hg-ink)]',
                className,
              )}
              aria-label={`Technical view name: ${children}`}
            />
          }
        >
          <Info className="size-[0.85em]" aria-hidden />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-left">
          <span>In the Technical view: </span>
          <span className="font-semibold">{children}</span>
        </TooltipContent>
      </Tooltip>
    </span>
  )
}