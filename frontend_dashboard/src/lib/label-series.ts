/**
 * Label series colours for Normal / Abuse / Hate (stat dots, volume charts, plain outcome bars, etc.).
 * **Change `Abuse` here** to try a new abusive-class colour everywhere it is used.
 * Hate on screen uses `--hg-matrix-error` (see VolumeChart); HateFallback is that token's default.
 */
export const LABEL_SERIES_COLOR = {
  // Normal: '#2f9e6b',
  Normal: '#38ada9',
  Abuse: '#f6b93b',
  HateFallback: '#c1002c',
} as const;
