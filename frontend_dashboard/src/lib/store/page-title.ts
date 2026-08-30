import { create } from 'zustand'

interface PageTitleState {
  /** Page-level SectionTitle heading used as the scroll-sync target. */
  titleEl: HTMLElement | null
  /** Uppercase chip label shown in the header. */
  chipLabel: string
  setPageTitle: (el: HTMLElement | null, chipLabel?: string) => void
}

export const usePageTitleStore = create<PageTitleState>((set) => ({
  titleEl: null,
  chipLabel: '',
  setPageTitle: (el, chipLabel = '') =>
    set({
      titleEl: el,
      chipLabel: chipLabel.trim().toUpperCase(),
    }),
}))
