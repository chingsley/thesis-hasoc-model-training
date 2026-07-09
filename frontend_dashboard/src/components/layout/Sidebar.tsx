import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  AlertTriangle,
  BrainCircuit,
  BarChart3,
  Beaker,
  Gauge,
  FileText,
  X,
} from 'lucide-react'
import { useDashboardStore } from '@/lib/store/dashboard'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/triage', label: 'Triage Queue', icon: AlertTriangle },
  { to: '/explainability', label: 'Explainability', icon: BrainCircuit },
  { to: '/analysis', label: 'Analysis', icon: BarChart3 },
  { to: '/testing', label: 'Testing Tools', icon: Beaker },
  { to: '/performance', label: 'Performance', icon: Gauge },
  { to: '/reports', label: 'Reports', icon: FileText },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation()
  const language = useDashboardStore((s) => s.language)

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 lg:relative lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-4 h-16 border-b border-border">
          <div>
            <h1 className="text-lg font-semibold text-foreground">HateGuard</h1>
            <p className="text-xs text-muted-foreground capitalize">{language} Monitor</p>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 px-2 py-4">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = location.pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </ScrollArea>
      </aside>
    </>
  )
}
