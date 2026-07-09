import { Bell, Menu, Globe, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useDashboardStore } from '@/lib/store/dashboard'
import type { Language } from '@/lib/types'
import { useLocation } from 'react-router-dom'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/triage': 'Triage Queue',
  '/explainability': 'Explainability',
  '/analysis': 'Analysis',
  '/testing': 'Testing Tools',
  '/performance': 'Performance',
  '/reports': 'Reports',
}

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation()
  const language = useDashboardStore((s) => s.language)
  const setLanguage = useDashboardStore((s) => s.setLanguage)
  const searchQuery = useDashboardStore((s) => s.searchQuery)
  const setSearchQuery = useDashboardStore((s) => s.setSearchQuery)
  const alerts = useDashboardStore((s) => s.alerts)
  const markAlertRead = useDashboardStore((s) => s.markAlertRead)
  const markAllAlertsRead = useDashboardStore((s) => s.markAllAlertsRead)
  const unreadCount = useDashboardStore((s) => s.unreadAlertCount)()

  const languages: { value: Language; label: string }[] = [
    { value: 'igbo', label: 'Igbo' },
    { value: 'yoruba', label: 'Yoruba' },
  ]

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold hidden sm:block truncate">
          {pageTitles[location.pathname] ?? 'Dashboard'}
        </h2>
      </div>

      <div className="flex items-center gap-2 flex-1 justify-end max-w-xl">
        <div className="relative hidden md:block flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl bg-muted/50"
          />
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-xl shrink-0">
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

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="relative shrink-0">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive text-destructive-foreground">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Alerts</span>
              {unreadCount > 0 && (
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => markAllAlertsRead()}
                >
                  Mark all read
                </button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {alerts.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">No alerts</div>
            ) : (
              alerts.slice(0, 8).map((alert) => (
                <DropdownMenuItem
                  key={alert.id}
                  className="flex flex-col items-start gap-1 cursor-pointer"
                  onClick={() => markAlertRead(alert.id)}
                >
                  <span className={alert.read ? 'text-muted-foreground' : 'font-medium'}>
                    {alert.message}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(alert.timestamp).toLocaleString()}
                  </span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
