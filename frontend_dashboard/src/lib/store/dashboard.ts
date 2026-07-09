import { create } from 'zustand'
import type { Language, AlertItem } from '@/lib/types'

interface DashboardState {
  language: Language
  setLanguage: (lang: Language) => void
  hateThreshold: number
  setHateThreshold: (t: number) => void
  alerts: AlertItem[]
  setAlerts: (alerts: AlertItem[]) => void
  unreadAlertCount: number
}

export const useDashboardStore = create<DashboardState>((set) => ({
  language: 'igbo',
  setLanguage: (lang) => set({ language: lang }),
  hateThreshold: 0.5,
  setHateThreshold: (t) => set({ hateThreshold: t }),
  alerts: [],
  setAlerts: (alerts) =>
    set({
      alerts,
      unreadAlertCount: alerts.filter((a) => !a.read).length,
    }),
  unreadAlertCount: 0,
}))
