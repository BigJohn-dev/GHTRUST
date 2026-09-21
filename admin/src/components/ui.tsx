import clsx from 'clsx'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  change?: number
  icon: React.ReactNode
  iconBg?: string
}

export function StatCard({ title, value, change, icon, iconBg = 'bg-slate-50 text-slate-600' }: StatCardProps) {
  const positive = (change ?? 0) >= 0
  return (
    <div className="dash-card p-5 lg:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-slate-400 uppercase tracking-wide">{title}</p>
          <p className="text-[26px] font-semibold text-navy tracking-tight mt-2 leading-none">{value}</p>
          {change !== undefined && (
            <div
              className={clsx(
                'inline-flex items-center gap-1 text-[12px] font-medium mt-3',
                positive ? 'text-emerald-600' : 'text-rose-500',
              )}
            >
              {positive ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {Math.abs(change)}% vs last month
            </div>
          )}
        </div>
        <div className={clsx('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', iconBg)}>
          {icon}
        </div>
      </div>
    </div>
  )
}

interface ProgressItemProps {
  title: string
  subtitle: string
  progress: number
  color?: string
}

export function ProgressItem({ title, subtitle, progress, color = 'bg-navy' }: ProgressItemProps) {
  return (
    <div className="py-4 first:pt-0 border-b border-slate-100/80 last:border-0">
      <div className="flex justify-between items-start gap-3 mb-2.5">
        <div className="min-w-0">
          <p className="font-medium text-navy text-[13px] leading-snug truncate">{title}</p>
          <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>
        </div>
        <span className="text-[11px] font-semibold text-slate-500 tabular-nums shrink-0">{progress}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

const statusStyles: Record<string, { bg: string; dot: string; text: string }> = {
  submitted: { bg: 'bg-sky-50', dot: 'bg-sky-500', text: 'text-sky-700' },
  under_review: { bg: 'bg-amber-50', dot: 'bg-amber-500', text: 'text-amber-700' },
  approved: { bg: 'bg-emerald-50', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  completed: { bg: 'bg-emerald-50', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  rejected: { bg: 'bg-rose-50', dot: 'bg-rose-500', text: 'text-rose-600' },
  disbursed: { bg: 'bg-slate-100', dot: 'bg-slate-600', text: 'text-slate-700' },
  draft: { bg: 'bg-slate-100', dot: 'bg-slate-400', text: 'text-slate-600' },
}

export function StatusPill({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ')
  const style = statusStyles[status] ?? { bg: 'bg-slate-100', dot: 'bg-slate-400', text: 'text-slate-600' }
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium capitalize',
        style.bg,
        style.text,
      )}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', style.dot)} />
      {label}
    </span>
  )
}

export function DashCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={clsx('dash-card', className)}>{children}</div>
}
