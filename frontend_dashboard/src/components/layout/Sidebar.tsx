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
const SIDEBAR_EASE =
  'transition-[width,padding,gap,opacity,max-width,margin,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'

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
    // Same padding & alignment in both states so icons never shift.
    'relative flex cursor-pointer items-center px-6 py-2.5 text-sm',
    SIDEBAR_EASE,
    active
      ? 'bg-[var(--hg-soft)] font-semibold text-black'
      : 'font-normal text-[var(--hg-muted)] hover:bg-[#eef1f6] hover:text-[var(--hg-ink)]',
  )

  const body = (
    <>
      <item.icon
        className={cn(
          'h-[18px] w-[18px] shrink-0 stroke-[1.75]',
          active ? 'text-black' : 'text-[var(--hg-subtle)]',
        )}
      />
      <span
        className={cn(
          'overflow-hidden whitespace-nowrap',
          SIDEBAR_EASE,
          collapsed
            ? 'ml-0 max-w-0 opacity-0'
            : 'ml-3 max-w-[11rem] opacity-100',
        )}
      >
        {item.label}
      </span>
    </>
  )

  return (
    <Tooltip>
      <TooltipTrigger
        delay={collapsed ? 250 : 10_000}
        render={
          <Link
            to={item.to}
            onClick={onNavigate}
            aria-label={item.label}
            className={linkClass}
          />
        }
      >
        {body}
      </TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={8}
        className={cn(!collapsed && 'hidden', 'lg:inline-flex')}
      >
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
          'fixed top-0 left-0 z-50 flex h-full w-64 flex-col overflow-hidden border-r border-[#e8edf5] bg-white',
          'transition-[width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'will-change-[width]',
          'lg:relative lg:translate-x-0',
          collapsed ? 'lg:w-[88px]' : 'lg:w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div
          className={cn(
            'relative flex h-16 shrink-0 items-center border-b border-[#e8edf5] px-4',
            SIDEBAR_EASE,
          )}
        >
          {/* Logomark stays fixed at the expanded inset; only the wordmark fades. */}
          <button
            type="button"
            className={cn(
              'relative z-10 flex shrink-0 items-center rounded-[4px]',
              collapsed
                ? 'cursor-pointer hover:bg-[var(--hg-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hg-brand)]/30'
                : 'cursor-default',
            )}
            onClick={collapsed ? toggleCollapsed : undefined}
            aria-label={collapsed ? 'Expand sidebar' : undefined}
            title={collapsed ? 'Expand sidebar' : undefined}
            tabIndex={collapsed ? 0 : -1}
          >
            <img
              src="/sidebar-logomark.png"
              alt=""
              width={56}
              height={49}
              className="shrink-0"
            />
          </button>

          <h1
            className={cn(
              'truncate text-lg font-semibold tracking-tight text-primary',
              SIDEBAR_EASE,
              collapsed
                ? 'ml-0 max-w-0 translate-x-1 overflow-hidden opacity-0'
                : 'ml-[2px] max-w-[10rem] translate-x-0 opacity-100',
            )}
          >
            HateGuard
          </h1>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'ml-auto hidden shrink-0 text-[var(--hg-muted)] lg:inline-flex',
              SIDEBAR_EASE,
              collapsed ? 'pointer-events-none w-0 opacity-0' : 'opacity-100',
            )}
            onClick={toggleCollapsed}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            tabIndex={collapsed ? -1 : 0}
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>

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
          {/* Same vertical rhythm expanded & collapsed — only labels/titles fade. */}
          <nav className="space-y-6">
            {navSections.map((section) => (
              <div key={section.title}>
                <p
                  className={cn(
                    'mb-2 px-6 text-[11px] font-medium tracking-[0.08em] text-[var(--hg-subtle)] uppercase',
                    SIDEBAR_EASE,
                    // Keep layout height; only fade so icons below don’t jump.
                    collapsed ? 'opacity-0' : 'opacity-100',
                  )}
                  aria-hidden={collapsed}
                >
                  {section.title}
                </p>
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
              SIDEBAR_EASE,
            )}
          >
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-sm text-[var(--hg-muted)]',
                SIDEBAR_EASE,
                collapsed ? 'max-w-0 opacity-0' : 'max-w-[12rem] opacity-100',
              )}
              title={user.email}
            >
              {user.org_name || user.email}
            </span>
            <Tooltip>
              <TooltipTrigger
                delay={collapsed ? 250 : 10_000}
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-[var(--hg-muted)]"
                    onClick={handleLogout}
                    aria-label="Sign out"
                    title={collapsed ? undefined : 'Sign out'}
                  />
                }
              >
                <LogOut className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={8}
                className={cn(!collapsed && 'hidden', 'lg:inline-flex')}
              >
                Sign out
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </aside>
    </>
  )
}
