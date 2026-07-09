import { Bell, Menu, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useDashboardStore } from '@/lib/store/dashboard'
import type { Language } from '@/lib/types'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const language = useDashboardStore((s) => s.language)
  const setLanguage = useDashboardStore((s) => s.setLanguage)
  const unreadAlertCount = useDashboardStore((s) => s.unreadAlertCount)

  const languages: { value: Language; label: string }[] = [
    { value: 'igbo', label: 'Igbo' },
    { value: 'yoruba', label: 'Yoruba' },
  ]

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold hidden sm:block">Dashboard</h2>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer text-foreground"
          >
            {languages.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadAlertCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive text-destructive-foreground">
              {unreadAlertCount}
            </Badge>
          )}
        </Button>
      </div>
    </header>
  )
}
