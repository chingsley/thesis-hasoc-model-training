import { cn } from '@/lib/utils'
import {
  LOGOMARK_FACES,
  LOGOMARK_LINEWORK,
  LOGOMARK_TRANSFORM,
  LOGOMARK_VIEW_BOX,
} from '@/components/brand/logomark-paths'

export type HateGuardLogomarkProps = {
  className?: string
  /** Square size in px. Ignored when `width`/`height` are set. */
  size?: number
  width?: number
  height?: number
  /** Strength of the shield faces. The line work always paints at full strength. */
  faceOpacity?: number
  title?: string
}

/**
 * HateGuard shield logomark (vector).
 *
 * Line work — hexagon outline, the separator between the two shield halves, and
 * the outlined "H" with its slash — is painted with `currentColor`. The faces are
 * the same colour at low opacity, so the outline/separator stay pronounced. The
 * "H" interior is left unpainted so the surface behind shows through (the
 * lighter middle).
 *
 * Use `text-white` on the auth hero and `text-primary` in the app shell.
 */
export function HateGuardLogomark({
  className,
  size = 40,
  width,
  height,
  faceOpacity = 0.14,
  title,
}: HateGuardLogomarkProps) {
  const w = width ?? size
  const h = height ?? size

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={LOGOMARK_VIEW_BOX}
      width={w}
      height={h}
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <g transform={LOGOMARK_TRANSFORM} fill="currentColor">
        <g fillOpacity={faceOpacity}>
          {LOGOMARK_FACES.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <path d={LOGOMARK_LINEWORK} />
      </g>
    </svg>
  )
}
