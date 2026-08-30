import { useCallback, useEffect, useState, type RefObject } from 'react'

/**
 * Progress of a page title scrolling under the sticky header.
 * 0 = title fully visible below the header (chip hidden above).
 * 1 = title fully under the header (chip fully descended).
 */
export function useTitleChipProgress(
  titleEl: HTMLElement | null,
  headerRef: RefObject<HTMLElement | null>,
  scrollRootRef: RefObject<HTMLElement | null>,
) {
  const [progress, setProgress] = useState(0)

  const measure = useCallback(() => {
    const header = headerRef.current
    const title = titleEl
    if (!header || !title) {
      setProgress(0)
      return
    }

    const headerBottom = header.getBoundingClientRect().bottom
    const titleRect = title.getBoundingClientRect()
    const range = Math.max(titleRect.height, 1)
    const next = Math.min(1, Math.max(0, (headerBottom - titleRect.top) / range))
    setProgress((prev) => (Math.abs(prev - next) < 0.002 ? prev : next))
  }, [headerRef, titleEl])

  useEffect(() => {
    const root = scrollRootRef.current
    measure()

    let frame = 0
    const onScrollOrResize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    root?.addEventListener('scroll', onScrollOrResize, { passive: true })
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      cancelAnimationFrame(frame)
      root?.removeEventListener('scroll', onScrollOrResize)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [measure, scrollRootRef, titleEl])

  useEffect(() => {
    measure()
  }, [measure, titleEl])

  return progress
}
