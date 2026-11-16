import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Dashboard-wide choice between the plain-language (non-expert) and technical (expert) designs.
 * Every page that offers both reads this one setting, so switching on one page switches all of
 * them, and the browser remembers the choice.
 */
export type ViewMode = 'plain' | 'technical'

/** View shown on a browser's first visit. */
export const DEFAULT_VIEW_MODE: ViewMode = 'plain'

export const VIEW_MODES: { value: ViewMode; label: string; title: string }[] = [
  { value: 'plain', label: 'Plain language', title: 'Simple view for everyday users' },
  { value: 'technical', label: 'Technical', title: 'Detailed view for analysts' },
]

interface ViewModeState {
  viewMode: ViewMode
  setViewMode: (viewMode: ViewMode) => void
}

export const useViewModeStore = create<ViewModeState>()(
  persist(
    (set) => ({
      viewMode: DEFAULT_VIEW_MODE,
      setViewMode: (viewMode) => set({ viewMode }),
    }),
    { name: 'hateguard-view-mode' },
  ),
)

export function useViewMode(): ViewMode {
  return useViewModeStore((s) => s.viewMode)
}
