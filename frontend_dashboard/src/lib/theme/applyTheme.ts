import { resolveThemeIdForSession } from './catalog'
import type { ColorThemeId } from './types'

export function applyColorTheme(themeId: ColorThemeId): void {
  document.documentElement.dataset.hgTheme = themeId
}

/** Call once before React mounts so the first paint uses the signed-in user's theme. */
export function initColorTheme(): ColorThemeId {
  const themeId = resolveThemeIdForSession()
  applyColorTheme(themeId)
  return themeId
}
