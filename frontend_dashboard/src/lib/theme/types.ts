export type ColorThemeId = 'classic' | 'sky' | 'noir'

export type ColorThemeMeta = {
  id: ColorThemeId
  label: string
  description: string
  preview: {
    shell: string
    accent: string
    soft: string
    primary: string
  }
}
