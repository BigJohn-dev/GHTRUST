import clsx from 'clsx'
import { Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { SIDEBAR_EASE, SIDEBAR_MS, useSidebarPin } from '../lib/sidebarPin'
import { NotificationsMenu } from './NotificationsMenu'
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
  if (pathname === '/support') return 'Support'
  if (pathname === '/customers') return 'Customers'
  if (pathname.startsWith('/customers/')) return 'Customer profile'
  if (pathname === '/settings') return 'Settings'
  if (pathname === '/profile') return 'My profile'
  return 'Dashboard'
}

const PEEK_OPEN_MS = 150
const PEEK_CLOSE_MS = 300
/** Peeking is for desktop pointers only; touch screens use the mobile drawer. */
const PEEK_MEDIA = '(min-width: 1024px) and (hover: hover)'

export function AdminLayout({ children, title, subtitle, tabs, activeTab, onTabChange }: AdminLayoutProps) {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pinned, togglePinned } = useSidebarPin()

  // Unpinned, the rail "peeks": hovering (or tabbing into) it slides the full menu over the
  // page without reflowing it. A short open delay ignores the cursor passing across it.
  const [peek, setPeek] = useState(false)
  const peekTimer = useRef<number | undefined>(undefined)
  const sidebarRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(peekTimer.current), [])

  const canPeek = () => !pinned && window.matchMedia(PEEK_MEDIA).matches
  const schedulePeek = (open: boolean, delay: number) => {
    window.clearTimeout(peekTimer.current)
    peekTimer.current = window.setTimeout(() => setPeek(open), delay)
  }
  const typingInSidebar = () => {
    const active = document.activeElement
    return !!active && active.tagName === 'INPUT' && !!sidebarRef.current?.contains(active)
  }

  const floating = peek && !pinned
  const expanded = mobileOpen || pinned || floating

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

      {/* Sidebar. Desktop: the wrapper reserves the rail or the pinned width, and the sidebar
          itself is absolutely positioned so a peek overlays the page. Mobile: a drawer. */}
      <div
        className={clsx(
          'shrink-0 h-screen z-50 transition-[transform,width]',
          'fixed lg:relative',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          pinned ? 'lg:w-[272px]' : 'lg:w-[72px]',
        )}
        style={{ transitionTimingFunction: SIDEBAR_EASE, transitionDuration: `${SIDEBAR_MS}ms` }}
      >
        <div
          ref={sidebarRef}
          className="h-full lg:absolute lg:inset-y-0 lg:left-0"
          onMouseEnter={() => canPeek() && schedulePeek(true, PEEK_OPEN_MS)}
          onMouseLeave={() => !typingInSidebar() && schedulePeek(false, PEEK_CLOSE_MS)}
          onFocus={() => canPeek() && schedulePeek(true, 0)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) schedulePeek(false, 0)
          }}
        >
          <AppSidebar
            collapsed={!expanded}
            pinned={pinned}
            floating={floating}
            onTogglePin={() => {
              setPeek(false)
              togglePinned()
            }}
            onNavigate={() => {
              setMobileOpen(false)
              setPeek(false)
            }}
          />
        </div>
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

          <NotificationsMenu />
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
