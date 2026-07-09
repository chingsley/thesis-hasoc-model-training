import { create } from 'zustand'
import type { AlertItem, Language } from '@/lib/types'

interface DashboardState {
  language: Language
  hateThreshold: number
  searchQuery: string
  alerts: AlertItem[]
  setLanguage: (language: Language) => void
  setHateThreshold: (threshold: number) => void
  setSearchQuery: (query: string) => void
  setAlerts: (alerts: AlertItem[]) => void
  addAlert: (alert: AlertItem) => void
  markAlertRead: (id: string) => void
  markAllAlertsRead: () => void
  unreadAlertCount: () => number
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  language: 'igbo',
  hateThreshold: 0.5,
  searchQuery: '',
  alerts: [],
  setLanguage: (language) => set({ language }),
  setHateThreshold: (hateThreshold) => set({ hateThreshold }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) =>
    set((state) => {
      if (state.alerts.some((a) => a.id === alert.id)) return state
      return { alerts: [alert, ...state.alerts] }
    }),
  markAlertRead: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)),
    })),
  markAllAlertsRead: () =>
    set((state) => ({
      alerts: state.alerts.map((a) => ({ ...a, read: true })),
    })),
  unreadAlertCount: () => get().alerts.filter((a) => !a.read).length,
}))
