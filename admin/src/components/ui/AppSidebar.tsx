import clsx from 'clsx'
import {
  ChevronLeft,
  FileText,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  UserCog,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { hasAnyPermission, hasPermission } from '../../lib/permissions'

const softSpring = 'cubic-bezier(0.25, 1.1, 0.4, 1)'

type NavItem = {
  to: string
  label: string
  icon: React.ReactNode
  end?: boolean
  disabled?: boolean
}

function buildSections(canManageTeam: boolean, canViewCustomers: boolean, canViewSettings: boolean): { title: string; items: NavItem[] }[] {
  const systemItems: NavItem[] = []
  if (canManageTeam) {
    systemItems.push({ to: '/team', label: 'Team', icon: <UserCog size={16} /> })
  }
  if (canViewCustomers) {
    systemItems.push({ to: '/customers', label: 'Customers', icon: <Users size={16} /> })
  } else {
    systemItems.push({ to: '/dashboard', label: 'Customers', icon: <Users size={16} />, disabled: true })
  }
  if (canViewSettings) {
    systemItems.push({ to: '/settings', label: 'Settings', icon: <Settings size={16} /> })
  } else {
    systemItems.push({ to: '/dashboard', label: 'Settings', icon: <Settings size={16} />, disabled: true })
  }
  return [
    {
      title: 'Overview',
      items: [{ to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} />, end: true }],
    },
    {
      title: 'Lending',
      items: [
        { to: '/applications', label: 'Loan queue', icon: <FileText size={16} /> },
        { to: '/loan-products', label: 'Loan products', icon: <HandCoins size={16} /> },
      ],
    },
    { title: 'System', items: systemItems },
  ]
}

interface AppSidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  onNavigate?: () => void
}

function GhLogo({ compact }: { compact?: boolean }) {
  return (
    <div className={clsx('flex items-center', compact ? 'justify-center' : 'gap-3 px-1')}>
      <div
        className={clsx(
          'rounded-lg bg-cyan flex items-center justify-center shrink-0 transition-all duration-300',
          compact ? 'h-7 w-7' : 'h-9 w-9',
        )}
      >
        <span className={clsx('font-bold text-white tracking-tight', compact ? 'text-[10px]' : 'text-[11px]')}>GH</span>
      </div>
      {!compact && (
        <div className="leading-tight min-w-0">
          <p className="text-[15px] font-semibold text-white tracking-tight">GH Trust</p>
          <p className="text-[11px] text-white/55 font-medium">Staff operations</p>
        </div>
      )}
    </div>
  )
}

export function AppSidebar({ collapsed, onToggleCollapse, onNavigate }: AppSidebarProps) {
  const { staff, logout } = useAuth()
  const [search, setSearch] = useState('')
  const firstName = staff?.full_name?.split(' ')[0] ?? 'Admin'
  const sections = buildSections(
    hasAnyPermission(staff, ['staff:read', 'role:read']),
    hasPermission(staff, 'loan:read'),
    hasPermission(staff, 'loan:read'),
  )

  return (
    <aside
      className={clsx(
        'flex flex-col h-screen bg-navy border-r border-white/10 transition-[width] duration-500 overflow-hidden',
        collapsed ? 'w-[72px]' : 'w-[272px]',
      )}
      style={{ transitionTimingFunction: softSpring }}
    >
      <div className={clsx('pt-5 pb-3', collapsed ? 'px-2' : 'px-4')}>
        {/* Collapsed, the toggle sits beside a smaller logo (72px rail: 28 + 4 + 24). */}
        <div className={clsx('flex items-center', collapsed ? 'justify-center gap-1' : 'justify-between')}>
          <GhLogo compact={collapsed} />
          <button
            type="button"
            onClick={onToggleCollapse}
            className={clsx(
              'rounded-lg flex items-center justify-center shrink-0 text-white/55 hover:text-white hover:bg-white/10 transition-colors',
              collapsed ? 'h-7 w-6' : 'h-8 w-8',
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft size={collapsed ? 14 : 16} className={clsx(collapsed && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className={clsx('pb-4', collapsed ? 'px-3 flex justify-center' : 'px-4')}>
        <div
          className={clsx(
            'relative flex items-center h-10 rounded-lg bg-white/10 ring-1 ring-white/10 transition-all duration-500',
            collapsed ? 'w-10 justify-center' : 'w-full',
          )}
          style={{ transitionTimingFunction: softSpring }}
        >
          <div className="flex items-center justify-center shrink-0 w-10">
            <Search size={15} className="text-white/65" />
          </div>
          {!collapsed && (
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-white placeholder:text-white/45 pr-3"
            />
          )}
        </div>
      </div>

      <nav className={clsx('flex-1 overflow-y-auto space-y-5', collapsed ? 'px-2' : 'px-3')}>
        {sections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/50">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                if (item.disabled) {
                  return (
                    <li key={item.label}>
                      <span
                        className={clsx(
                          'flex items-center rounded-lg text-[13px] font-medium text-white/30 cursor-not-allowed',
                          collapsed ? 'h-10 w-10 justify-center mx-auto' : 'gap-3 px-3 py-2.5',
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        {item.icon}
                        {!collapsed && (
                          <>
                            <span className="flex-1">{item.label}</span>
                            <span className="text-[9px] uppercase tracking-wide font-semibold text-white/30">
                              Soon
                            </span>
                          </>
                        )}
                      </span>
                    </li>
                  )
                }
                return (
                  <li key={item.label}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center rounded-lg text-[13px] font-medium transition-colors duration-200',
                          collapsed ? 'h-10 w-10 justify-center mx-auto' : 'gap-3 px-3 py-2.5',
                          isActive
                            ? 'bg-white/15 text-white ring-1 ring-white/15'
                            : 'text-white/65 hover:text-white hover:bg-white/10',
                        )
                      }
                    >
                      {item.icon}
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={clsx('mt-auto border-t border-white/10 p-3', collapsed && 'flex justify-center')}>
        {collapsed ? (
          <button
            type="button"
            onClick={logout}
            className="h-10 w-10 rounded-lg flex items-center justify-center text-white/50 hover:text-rose-300 hover:bg-white/10"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        ) : (
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition-colors">
            <div className="h-9 w-9 rounded-lg bg-white/10 ring-1 ring-white/15 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
              {firstName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-white truncate">{staff?.full_name}</p>
              <p className="text-[11px] text-white/50 truncate">{staff?.email ?? 'Staff'}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="p-2 rounded-lg text-white/50 hover:text-rose-300 hover:bg-white/10 transition-colors"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
