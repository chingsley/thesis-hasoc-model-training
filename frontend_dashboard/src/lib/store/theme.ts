import { create } from 'zustand'
import { applyColorTheme } from '@/lib/theme/applyTheme'
import {
  DEFAULT_THEME_ID,
  readStoredThemeIdForUser,
  resolveThemeIdForSession,
  writeGlobalThemeId,
  writeStoredThemeIdForUser,
} from '@/lib/theme/catalog'
import type { ColorThemeId } from '@/lib/theme/types'
import { useAuthStore } from '@/lib/store/auth'

interface ThemeState {
  themeId: ColorThemeId
  setThemeId: (themeId: ColorThemeId) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeId: resolveThemeIdForSession(),
  setThemeId: (themeId) => {
    const userId = useAuthStore.getState().user?.id
    if (userId == null) return

    writeStoredThemeIdForUser(userId, themeId)
    writeGlobalThemeId(themeId)
    applyColorTheme(themeId)
    set({ themeId })
  },
}))

export function resetThemeToDefault(): void {
  useThemeStore.getState().setThemeId(DEFAULT_THEME_ID)
}

function syncThemeWithAuthUser(userId: number | null): void {
  let themeId: ColorThemeId
  if (userId != null) {
    themeId = readStoredThemeIdForUser(userId)
  } else {
    // Keep the active palette on the login page (do not snap back to classic).
    themeId = useThemeStore.getState().themeId
    writeGlobalThemeId(themeId)
  }
  applyColorTheme(themeId)
  useThemeStore.setState({ themeId })
}

let lastSyncedUserId: number | null | undefined

useAuthStore.subscribe((state) => {
  const userId = state.user?.id ?? null
  if (userId === lastSyncedUserId) return
  lastSyncedUserId = userId
  syncThemeWithAuthUser(userId)
})
