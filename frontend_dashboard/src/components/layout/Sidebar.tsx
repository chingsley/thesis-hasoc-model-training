import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  AlertTriangle,
  BrainCircuit,
  BarChart3,
  Beaker,
  Gauge,
  FileText,
  LogOut,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth'
import { logout } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

type NavItem = { to: string; label: string; icon: LucideIcon }

type NavSection = { title: string; items: NavItem[] }

const navSections: NavSection[] = [
  {
    title: 'Monitor',
    items: [
      { to: '/', label: 'Overview', icon: LayoutDashboard },
      { to: '/triage', label: 'Triage Queue', icon: AlertTriangle },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { to: '/explainability', label: 'Explainability', icon: BrainCircuit },
      { to: '/analysis', label: 'Analysis', icon: BarChart3 },
      { to: '/performance', label: 'Performance', icon: Gauge },
    ],
  },
  {
    title: 'Tools',
    items: [
      { to: '/testing', label: 'Testing Tools', icon: Beaker },
      { to: '/reports', label: 'Reports', icon: FileText },
    ],
  },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clear)

  const handleLogout = async () => {
    await logout()
    clearAuth()
    navigate('/login')
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 cursor-pointer bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 flex h-full w-64 flex-col border-r border-[#e8edf5] bg-white transition-transform duration-200 lg:relative lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-[#e8edf5] px-4">
          <div className="flex items-center gap-2.5">
            <img
              src="/favicon.svg"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0"
            />
            <h1 className="text-lg font-semibold tracking-tight text-primary">HateGuard</h1>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="relative flex-1 py-5">
          <nav className="space-y-6">
            {navSections.map((section) => (
              <div key={section.title}>
                <p className="mb-2 px-6 text-[11px] font-medium tracking-[0.08em] text-[#9aa8bd] uppercase">
                  {section.title}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = location.pathname === item.to
                    return (
                      <li key={item.to} className="relative">
                        <Link
                          to={item.to}
                          onClick={onClose}
                          className={cn(
                            'relative flex cursor-pointer items-center gap-3 px-6 py-2.5 text-sm transition-colors',
                            active
                              ? 'bg-[var(--hg-secondary)] font-medium text-white'
                              : 'font-normal text-[#6b7c93] hover:bg-[#eef1f6] hover:text-[#4a5a73]',
                          )}
                        >
                          <item.icon
                            className={cn(
                              'h-[18px] w-[18px] shrink-0 stroke-[1.75]',
                              active ? 'text-white' : 'text-[#8a9bb0]',
                            )}
                          />
                          {item.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {user && (
          <div className="mt-auto flex items-center gap-2 border-t border-[#e8edf5] bg-white px-4 py-3">
            <span
              className="min-w-0 flex-1 truncate text-sm text-[#6b7c93]"
              title={user.email}
            >
              {user.org_name || user.email}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-[#6b7c93]"
              onClick={handleLogout}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </aside>
    </>
  )
}
