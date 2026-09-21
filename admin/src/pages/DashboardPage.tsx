import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  ArrowUpRight,
  Briefcase,
  ChevronRight,
  Download,
  Filter,
  HandCoins,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { AdminLayout } from '../components/AdminLayout'
import { PermissionGate } from '../components/PermissionGate'
import { DashCard, ProgressItem, StatCard, StatusPill } from '../components/ui'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../components/ui/line-chart'
import { useAuth } from '../lib/auth'
import { dashboardApi, formatNaira, type DashboardData, type DemographicBucket } from '../lib/dashboardApi'
import { downloadDemographicsCsv } from '../lib/exportDemographics'
import { initials } from '../lib/productMeta'

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'applications', label: 'Applications' },
  { id: 'statistics', label: 'Statistics' },
]

const submissionsConfig = {
  count: { label: 'Applications', color: '#0B84CE' },
} satisfies ChartConfig

const DAY_COLORS = ['#0B84CE', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444']

const GENDER_COLORS: Record<string, string> = {
  Male: '#0B84CE',
  Female: '#ec4899',
  Unknown: '#94a3b8',
}

const AGE_COLORS = ['#0B84CE', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b']

function formatAppDate(ts: string | null | undefined): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DashboardPage() {
  return (
    <PermissionGate permission="loan:read">
      <DashboardPageContent />
    </PermissionGate>
  )
}

function DashboardPageContent() {
  const [activeTab, setActiveTab] = useState('overview')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { token } = useAuth()
  const navigate = useNavigate()

  const handleExportDemographics = () => {
    if (!data?.demographics) return
    downloadDemographicsCsv(data.demographics)
  }

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError('')
    dashboardApi
      .get(token)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [token])

  const dailyChart = useMemo(() => {
    if (!data) return []
    return data.daily_submissions.map((d, idx) => ({
      day: new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short' }),
      count: d.count,
      fill: DAY_COLORS[idx % DAY_COLORS.length],
    }))
  }, [data])

  const statusChart = useMemo(() => {
    if (!data) return []
    const colors: Record<string, string> = {
      under_review: '#f59e0b',
      submitted: '#0B84CE',
      approved: '#22c55e',
      disbursed: '#14b8a6',
      rejected: '#ef4444',
      draft: '#94a3b8',
    }
    return data.status_counts.map((s) => ({
      status: s.status.replace(/_/g, ' '),
      count: s.count,
      fill: colors[s.status] ?? '#64748b',
    }))
  }, [data])

  if (loading) {
    return (
      <AdminLayout title="Dashboard" subtitle="Portfolio overview and recent activity">
        <div className="flex items-center justify-center py-24">
          <div className="h-10 w-10 rounded-full border-2 border-slate-200 border-t-[#1b2f6b] animate-spin" />
        </div>
      </AdminLayout>
    )
  }

  if (error || !data) {
    return (
      <AdminLayout title="Dashboard" subtitle="Portfolio overview and recent activity">
        <div className="dash-card p-8 text-center">
          <p className="text-rose-600 font-medium">{error || 'Unable to load dashboard'}</p>
        </div>
      </AdminLayout>
    )
  }

  const productMix = data.product_mix.length
    ? data.product_mix
    : [{ product_code: '—', product_name: 'No applications yet', count: 0, percentage: 0 }]

  const rejectedCount = data.status_counts.find((s) => s.status === 'rejected')?.count ?? 0

  return (
    <AdminLayout
      title="Dashboard"
      subtitle="Portfolio overview and recent activity"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 lg:gap-6">
          <div className="xl:col-span-4 space-y-5 lg:space-y-6">
            <DashCard className="p-6 lg:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-medium text-slate-400 uppercase tracking-wide">
                    Total loan book
                  </p>
                  <p className="text-[32px] lg:text-[34px] font-semibold text-navy tracking-tight mt-2 leading-none">
                    {formatNaira(data.loan_book_amount)}
                  </p>
                  <p className="inline-flex items-center gap-1 text-[12px] text-emerald-600 font-medium mt-3">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    {data.total_applications} total applications
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-navy/[0.06] flex items-center justify-center shrink-0">
                  <HandCoins className="h-[18px] w-[18px] text-navy/70" />
                </div>
              </div>

              <div className="flex gap-2.5 mt-7">
                <button
                  type="button"
                  onClick={() => navigate('/applications?status=approved')}
                  className="flex-1 bg-navy text-white text-[13px] font-semibold py-2.5 rounded-lg hover:bg-navy-dark transition-colors"
                >
                  Disburse
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/applications?status=under_review')}
                  className="flex-1 text-navy text-[13px] font-semibold py-2.5 rounded-lg ring-1 ring-slate-200/90 hover:bg-slate-50 transition-colors"
                >
                  Review queue
                </button>
              </div>
            </DashCard>

            <DashCard className="p-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[14px] font-semibold text-navy">Pending reviews</h3>
                <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-semibold tabular-nums">
                  {data.pending_review_count} open
                </span>
              </div>
              <div className="mt-4">
                {data.pending_queue.length === 0 ? (
                  <p className="text-[13px] text-slate-400 py-4 text-center">No pending reviews</p>
                ) : (
                  data.pending_queue.map((item) => (
                    <ProgressItem
                      key={item.id}
                      title={`${item.product_name} — ${item.applicant_name ?? 'Applicant'}`}
                      subtitle={`${formatNaira(item.requested_amount)} requested`}
                      progress={item.stage_progress_pct ?? 0}
                    />
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={() => navigate('/applications')}
                className="mt-2 w-full flex items-center justify-center gap-1 text-[12px] font-medium text-slate-400 hover:text-[#1b2f6b] py-2 transition-colors"
              >
                View all applications
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </DashCard>
          </div>

          <div className="xl:col-span-8 space-y-5 lg:space-y-6">
            <div className="grid sm:grid-cols-2 gap-4 lg:gap-5">
              <StatCard
                title="Total disbursed"
                value={formatNaira(data.total_disbursed_amount)}
                change={0}
                icon={<Wallet className="h-[18px] w-[18px]" />}
                iconBg="bg-emerald-50 text-emerald-600"
              />
              <StatCard
                title="In pipeline"
                value={String(data.pending_review_count)}
                change={0}
                icon={<TrendingUp className="h-[18px] w-[18px]" />}
                iconBg="bg-slate-100 text-slate-600"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4 lg:gap-5">
              <DashCard className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[14px] font-semibold text-navy">Portfolio mix</h3>
                </div>
                <div className="space-y-4">
                  {productMix.map((item) => (
                    <div key={item.product_code}>
                      <div className="flex justify-between text-[13px] mb-1.5">
                        <span className="text-slate-500">{item.product_name}</span>
                        <span className="font-semibold text-navy tabular-nums">{item.percentage}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 bg-[#1B2F6B]"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </DashCard>

              <DashCard className="p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-semibold text-navy">Application outcomes</h3>
                  <Briefcase className="h-[16px] w-[16px] text-slate-300" />
                </div>
                <p className="text-[36px] font-semibold text-navy tracking-tight leading-none">
                  {data.total_applications}
                </p>
                <p className="text-[12px] text-slate-400 mt-2">Applications across all products</p>
                <div className="mt-auto pt-5">
                  {rejectedCount > 0 && (
                    <div className="p-3 rounded-lg bg-rose-50/80 ring-1 ring-rose-100">
                      <p className="text-[12px] text-rose-700 font-medium leading-snug">
                        {rejectedCount} rejected application{rejectedCount === 1 ? '' : 's'} on record
                      </p>
                    </div>
                  )}
                </div>
              </DashCard>
            </div>

            <RecentApplicationsTable applications={data.recent_applications} />
          </div>
        </div>
      )}

      {activeTab === 'applications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-slate-500">
              Showing {data.recent_applications.length} most recent applications
            </p>
            <button
              type="button"
              onClick={() => navigate('/applications')}
              className="text-[13px] font-semibold text-[#1b2f6b] hover:underline"
            >
              View full queue
            </button>
          </div>
          <RecentApplicationsTable applications={data.recent_applications} linkRows />
        </div>
      )}

      {activeTab === 'statistics' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-navy">Demographics report</h2>
              <p className="text-[12px] text-slate-400 mt-0.5">
                Based on {data.demographics.total_applicants} loan applicant{data.demographics.total_applicants === 1 ? '' : 's'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportDemographics}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1b2f6b] text-white text-[13px] font-semibold hover:bg-[#141f45] shadow-sm"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <DemographicStatCard
              label="Male applicants"
              value={data.demographics.gender.find((g) => g.label === 'Male')?.count ?? 0}
              pct={data.demographics.gender.find((g) => g.label === 'Male')?.percentage ?? 0}
              icon={<Users className="h-4 w-4 text-sky-600" />}
            />
            <DemographicStatCard
              label="Female applicants"
              value={data.demographics.gender.find((g) => g.label === 'Female')?.count ?? 0}
              pct={data.demographics.gender.find((g) => g.label === 'Female')?.percentage ?? 0}
              icon={<Users className="h-4 w-4 text-pink-600" />}
            />
            <DemographicStatCard
              label="Top state (residence)"
              value={data.demographics.state_of_residence[0]?.count ?? 0}
              pct={data.demographics.state_of_residence[0]?.percentage ?? 0}
              subtitle={data.demographics.state_of_residence[0]?.label ?? '—'}
              icon={<Briefcase className="h-4 w-4 text-violet-600" />}
            />
            <DemographicStatCard
              label="Largest age group"
              value={data.demographics.age_buckets[0]?.count ?? 0}
              pct={data.demographics.age_buckets[0]?.percentage ?? 0}
              subtitle={data.demographics.age_buckets[0]?.label ?? '—'}
              icon={<TrendingUp className="h-4 w-4 text-amber-600" />}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <DemographicChartCard
              title="Gender distribution"
              subtitle="Male vs female applicants"
              buckets={data.demographics.gender}
              colors={(label) => GENDER_COLORS[label] ?? '#64748b'}
            />
            <DemographicChartCard
              title="Age distribution"
              subtitle="Applicant age groups"
              buckets={data.demographics.age_buckets}
              colors={(_, i) => AGE_COLORS[i % AGE_COLORS.length]}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <DemographicBarCard
              title="State of residence"
              subtitle="Where applicants live"
              buckets={data.demographics.state_of_residence}
            />
            <DemographicBarCard
              title="State of origin"
              subtitle="Applicant home states"
              buckets={data.demographics.state_of_origin}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <DashCard className="p-6">
              <h3 className="text-[14px] font-semibold text-navy mb-1">Daily submissions</h3>
              <p className="text-[11px] text-slate-400 mb-4">Last 7 days</p>
              <ChartContainer config={submissionsConfig} className="h-[200px] min-h-0 aspect-auto w-full">
                <BarChart data={dailyChart} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={4} fontSize={10} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} fontSize={10} />
                  <ChartTooltip cursor={{ fill: 'rgba(11,132,206,0.08)' }} content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
                    {dailyChart.map((entry) => (
                      <Cell key={entry.day} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </DashCard>

            <DashCard className="p-6">
              <h3 className="text-[14px] font-semibold text-navy mb-1">By status</h3>
              <p className="text-[11px] text-slate-400 mb-4">{data.total_applications} applications</p>
              <ChartContainer config={submissionsConfig} className="h-[200px] min-h-0 aspect-auto w-full">
                <BarChart data={statusChart} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="status"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    fontSize={9}
                    interval={0}
                    tickFormatter={(v: string) => v.slice(0, 6)}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} fontSize={10} />
                  <ChartTooltip cursor={{ fill: 'rgba(139,92,246,0.08)' }} content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
                    {statusChart.map((entry) => (
                      <Cell key={entry.status} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </DashCard>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

function DemographicStatCard({
  label,
  value,
  pct,
  subtitle,
  icon,
}: {
  label: string
  value: number
  pct: number
  subtitle?: string
  icon: React.ReactNode
}) {
  return (
    <DashCard className="p-4 flex items-start gap-3">
      <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
          {subtitle ? subtitle : value}
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {subtitle ? `${value} applicants · ${pct}%` : `${pct}% of total`}
        </p>
      </div>
    </DashCard>
  )
}

function DemographicChartCard({
  title,
  subtitle,
  buckets,
  colors,
}: {
  title: string
  subtitle: string
  buckets: DemographicBucket[]
  colors: (label: string, index: number) => string
}) {
  const chartData = buckets.map((b, i) => ({
    name: b.label,
    value: b.count,
    fill: colors(b.label, i),
  }))

  return (
    <DashCard className="p-6">
      <h3 className="text-[14px] font-semibold text-navy">{title}</h3>
      <p className="text-[11px] text-slate-400 mb-4">{subtitle}</p>
      {chartData.length === 0 ? (
        <p className="text-[13px] text-slate-400 py-8 text-center">No demographic data yet</p>
      ) : (
        <>
          <ChartContainer config={{ value: { label: 'Count' } }} className="h-[180px] min-h-0 aspect-auto w-full mx-auto max-w-[220px]">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
          <div className="mt-4 space-y-2">
            {buckets.map((b, i) => (
              <div key={b.label} className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: colors(b.label, i) }} />
                  {b.label}
                </span>
                <span className="font-semibold text-slate-800 tabular-nums">{b.count} ({b.percentage}%)</span>
              </div>
            ))}
          </div>
        </>
      )}
    </DashCard>
  )
}

function DemographicBarCard({
  title,
  subtitle,
  buckets,
}: {
  title: string
  subtitle: string
  buckets: DemographicBucket[]
}) {
  const top = buckets.slice(0, 8)
  const max = top[0]?.count ?? 1

  return (
    <DashCard className="p-6">
      <h3 className="text-[14px] font-semibold text-navy">{title}</h3>
      <p className="text-[11px] text-slate-400 mb-4">{subtitle}</p>
      {top.length === 0 ? (
        <p className="text-[13px] text-slate-400 py-8 text-center">No data yet</p>
      ) : (
        <div className="space-y-3">
          {top.map((b) => (
            <div key={b.label}>
              <div className="flex justify-between text-[12px] mb-1">
                <span className="text-slate-600 truncate pr-2">{b.label}</span>
                <span className="font-semibold text-slate-800 tabular-nums shrink-0">{b.count} ({b.percentage}%)</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#1b2f6b] transition-all"
                  style={{ width: `${Math.max(4, (b.count / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </DashCard>
  )
}

function RecentApplicationsTable({
  applications,
  linkRows = false,
}: {
  applications: DashboardData['recent_applications']
  linkRows?: boolean
}) {
  const navigate = useNavigate()

  return (
    <DashCard className="overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100/80">
        <div>
          <h3 className="text-[14px] font-semibold text-navy">Recent loan applications</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Latest submissions across all products</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-lg px-3 py-1.5 transition-colors"
        >
          <Filter className="h-3.5 w-3.5" />
          Filter
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              <th className="px-6 py-3">Applicant</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3 text-right">Amount</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {applications.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-[13px] text-slate-400">
                  No applications yet
                </td>
              </tr>
            ) : (
              applications.map((row) => {
                const name = row.applicant_name ?? 'Applicant'
                const content = (
                  <>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-slate-100 text-navy flex items-center justify-center text-[10px] font-bold group-hover:bg-navy/10 transition-colors">
                          {initials(name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-navy truncate">{name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{row.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-[13px] text-slate-500">{row.product_name}</td>
                    <td className="px-6 py-3.5 text-[12px] text-slate-400 whitespace-nowrap tabular-nums">
                      {formatAppDate(row.submitted_at ?? row.created_at)}
                    </td>
                    <td className="px-6 py-3.5 text-[13px] font-semibold text-navy text-right tabular-nums">
                      {formatNaira(row.requested_amount)}
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusPill status={row.status} />
                    </td>
                  </>
                )

                return (
                  <tr
                    key={row.id}
                    onClick={linkRows ? () => navigate(`/applications/${row.id}`) : undefined}
                    className={clsx(
                      'border-t border-slate-50 hover:bg-slate-50/60 transition-colors group',
                      linkRows ? 'cursor-pointer' : 'cursor-default',
                    )}
                  >
                    {content}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </DashCard>
  )
}
