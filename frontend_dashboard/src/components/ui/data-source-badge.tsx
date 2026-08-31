import type { ReactNode } from 'react'
import { isValidElement, useLayoutEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { USE_MOCK } from '@/lib/api/config'
import { usePageTitleStore } from '@/lib/store/page-title'
import { cn } from '@/lib/utils'

export function DataSourceBadge({ className }: { className?: string }) {
  if (!USE_MOCK) return null
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-amber-500/50 bg-amber-500/10 font-mono text-[10px] tracking-wide text-amber-700 uppercase dark:text-amber-400',
        className,
      )}
    >
      mock
    </Badge>
  )
}

function nodeText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children)
  return ''
}

export function SectionTitle({
  children,
  className,
  description,
  size = 'lg',
  inverted = false,
  /** When true (default for size=lg), syncs this heading with the header title chip. */
  pageTitle,
}: {
  children: ReactNode
  className?: string
  description?: ReactNode
  size?: 'lg' | 'md'
  inverted?: boolean
  pageTitle?: boolean
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const setPageTitle = usePageTitleStore((s) => s.setPageTitle)
  const trackAsPageTitle = pageTitle ?? size === 'lg'

  useLayoutEffect(() => {
    if (!trackAsPageTitle) return
    const el = headingRef.current
    if (!el) return
    setPageTitle(el, nodeText(children).trim())
    return () => {
      if (usePageTitleStore.getState().titleEl === el) setPageTitle(null)
    }
  }, [trackAsPageTitle, setPageTitle, children])

  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h2
          ref={headingRef}
          data-page-title={trackAsPageTitle ? '' : undefined}
          className={cn(
            'leading-tight font-semibold tracking-tight',
            size === 'lg' ? 'text-[32px]' : 'text-[24px]',
            inverted ? 'text-white' : 'text-[var(--hg-ink)]',
          )}
        >
          {children}
        </h2>
        <DataSourceBadge />
      </div>
      {description ? (
        <p className={cn('text-sm', inverted ? 'text-white/90' : 'text-[var(--hg-muted)]')}>
          {description}
        </p>
      ) : null}
    </div>
  )
}
