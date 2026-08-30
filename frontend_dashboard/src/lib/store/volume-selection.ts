import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DEFAULT_VOLUME_PRESET,
  defaultCustomRange,
  type ChartStyle,
  type VolumeMode,
} from '@/lib/volume-range'

interface VolumeSelectionState {
  mode: VolumeMode
  customFrom: string
  customTo: string
  chartStyle: ChartStyle
  setPreset: (id: Exclude<VolumeMode, 'custom'>) => void
  setCustomMode: () => void
  setCustomRange: (from: string, to: string) => void
  setChartStyle: (style: ChartStyle) => void
}

const initialCustom = defaultCustomRange()

export const useVolumeSelectionStore = create<VolumeSelectionState>()(
  persist(
    (set) => ({
      mode: DEFAULT_VOLUME_PRESET,
      customFrom: initialCustom.from,
      customTo: initialCustom.to,
      chartStyle: 'line',
      setPreset: (id) => set({ mode: id }),
      setCustomMode: () => set({ mode: 'custom' }),
      setCustomRange: (from, to) => set({ mode: 'custom', customFrom: from, customTo: to }),
      setChartStyle: (chartStyle) => set({ chartStyle }),
    }),
    { name: 'hateguard-volume-selection' },
  ),
)
