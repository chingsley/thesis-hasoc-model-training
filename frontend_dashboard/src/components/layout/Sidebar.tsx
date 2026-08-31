import { useEffect, useState } from 'react'
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
  PanelLeftClose,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth'
import { logout } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

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

const COLLAPSED_KEY = 'hg-sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

function NavLinkItem({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  onNavigate: () => void
}) {
  const linkClass = cn(
    'relative flex cursor-pointer items-center gap-3 px-6 py-2.5 text-sm transition-colors',
    collapsed && 'lg:justify-center lg:gap-0 lg:px-0',
    active
      ? 'bg-[var(--hg-soft)] font-semibold text-black'
      : 'font-normal text-[var(--hg-muted)] hover:bg-[#eef1f6] hover:text-[var(--hg-ink)]',
  )

  const icon = (
    <item.icon
      className={cn(
        'h-[18px] w-[18px] shrink-0 stroke-[1.75]',
        active ? 'text-black' : 'text-[var(--hg-subtle)]',
      )}
    />
  )

  const label = (
    <span className={cn(collapsed && 'lg:sr-only')}>{item.label}</span>
  )

  if (!collapsed) {
    return (
      <Link to={item.to} onClick={onNavigate} className={linkClass}>
        {icon}
        {label}
      </Link>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        delay={200}
        render={
          <Link
            to={item.to}
            onClick={onNavigate}
            aria-label={item.label}
            className={linkClass}
          />
        }
      >
        {icon}
        {label}
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="hidden lg:inline-flex">
        {item.label}
      </TooltipContent>
    </Tooltip>
  )
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clear)
  const [collapsed, setCollapsed] = useState(readCollapsed)

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  const handleLogout = async () => {
    await logout()
    clearAuth()
    navigate('/login')
  }

  const toggleCollapsed = () => setCollapsed((v) => !v)

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 cursor-pointer bg-black/50 lg:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside
        data-collapsed={collapsed || undefined}
        className={cn(
          'fixed top-0 left-0 z-50 flex h-full w-64 flex-col border-r border-[#e8edf5] bg-white',
          'transition-[width,transform] duration-200 ease-out',
          'lg:relative lg:translate-x-0',
          collapsed ? 'lg:w-[72px]' : 'lg:w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center justify-between gap-2 border-b border-[#e8edf5] px-4',
            collapsed && 'lg:justify-center lg:px-2',
          )}
        >
          <div
            className={cn(
              'flex min-w-0 items-center gap-2.5',
              collapsed && 'lg:hidden',
            )}
          >
            <img
              src="/favicon.svg"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0"
            />
            <h1 className="truncate text-lg font-semibold tracking-tight text-primary">
              HateGuard
            </h1>
          </div>

          {collapsed ? (
            <button
              type="button"
              className="hidden size-10 items-center justify-center rounded-[4px] transition-colors hover:bg-[var(--hg-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hg-brand)]/30 lg:inline-flex"
              onClick={toggleCollapsed}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <img
                src="/favicon.svg"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8"
              />
            </button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden text-[var(--hg-muted)] lg:inline-flex"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMobileClose}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="relative flex-1 py-5">
          <nav className={cn('space-y-6', collapsed && 'lg:space-y-3')}>
            {navSections.map((section, sectionIndex) => (
              <div key={section.title}>
                <p
                  className={cn(
                    'mb-2 px-6 text-[11px] font-medium tracking-[0.08em] text-[var(--hg-subtle)] uppercase',
                    collapsed && 'lg:sr-only',
                  )}
                >
                  {section.title}
                </p>
                {collapsed && sectionIndex > 0 && (
                  <div
                    className="mx-3 mb-2 hidden border-t border-[#e8edf5] lg:block"
                    aria-hidden
                  />
                )}
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = location.pathname === item.to
                    return (
                      <li key={item.to} className="relative">
                        <NavLinkItem
                          item={item}
                          active={active}
                          collapsed={collapsed}
                          onNavigate={onMobileClose}
                        />
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {user && (
          <div
            className={cn(
              'mt-auto flex items-center gap-2 border-t border-[#e8edf5] bg-white px-4 py-3',
              collapsed && 'lg:justify-center lg:px-2',
            )}
          >
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-sm text-[var(--hg-muted)]',
                collapsed && 'lg:sr-only',
              )}
              title={user.email}
            >
              {user.org_name || user.email}
            </span>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger
                  delay={200}
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-[var(--hg-muted)]"
                      onClick={handleLogout}
                      aria-label="Sign out"
                    />
                  }
                >
                  <LogOut className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="hidden lg:inline-flex">
                  Sign out
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-[var(--hg-muted)]"
                onClick={handleLogout}
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </aside>
    </>
  )
}
