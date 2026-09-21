import clsx from 'clsx'
import { Bell, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AppSidebar } from './ui/AppSidebar'

interface AdminLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  tabs?: { id: string; label: string }[]
  activeTab?: string
  onTabChange?: (id: string) => void
}

function pageTitleFromPath(pathname: string): string {
  if (pathname.startsWith('/applications/')) return 'Application detail'
  if (pathname === '/applications') return 'Loan queue'
  if (pathname === '/loan-products') return 'Loan products'
  if (pathname === '/team') return 'Team management'
  if (pathname === '/customers') return 'Customers'
  if (pathname.startsWith('/customers/')) return 'Customer profile'
  if (pathname === '/settings') return 'Settings'
  return 'Dashboard'
}

export function AdminLayout({ children, title, subtitle, tabs, activeTab, onTabChange }: AdminLayoutProps) {
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const pageTitle = title ?? pageTitleFromPath(location.pathname)

  return (
    <div className="h-screen overflow-hidden bg-[#f4f5f7] flex">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — fixed on mobile; pinned in flex row on desktop (does not scroll with content) */}
      <div
        className={clsx(
          'shrink-0 h-screen z-50 transition-transform duration-200',
          'fixed lg:relative',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onNavigate={() => setMobileOpen(false)}
        />
      </div>

      {/* Main — only this column scrolls */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-screen overflow-hidden">
        <header className="shrink-0 flex h-14 items-center gap-4 border-b border-slate-200/90 bg-white px-4 lg:px-8">
          <button
            type="button"
            className="lg:hidden p-2 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100"
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-semibold text-slate-900 truncate">{pageTitle}</h1>
            {subtitle && (
              <p className="text-[11px] text-slate-400 truncate hidden sm:block">{subtitle}</p>
            )}
          </div>

          <button
            type="button"
            className="relative h-9 w-9 rounded-lg bg-slate-100 ring-1 ring-slate-200/80 flex items-center justify-center hover:bg-white transition-colors"
          >
            <Bell className="h-[15px] w-[15px] text-slate-500" />
            <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-[#1b2f6b] ring-2 ring-white" />
          </button>
        </header>

        {tabs && (
          <div className="shrink-0 border-b border-slate-200/90 bg-white px-4 lg:px-8">
            <div className="flex gap-1 -mb-px overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange?.(tab.id)}
                  className={clsx(
                    'relative px-4 py-3 text-[13px] font-medium whitespace-nowrap transition-colors',
                    activeTab === tab.id ? 'text-[#1b2f6b]' : 'text-slate-400 hover:text-slate-600',
                  )}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#1b2f6b] rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-[1440px] w-full mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}
