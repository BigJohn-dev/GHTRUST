import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Badge } from './ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from './ui/line-chart'
import { formatNaira, type ApplicationSummary } from '../lib/loansApi'

interface LoanQueueChartsProps {
  /** The whole queue: the status chart always shows every status. */
  applications: ApplicationSummary[]
  /** The selected tab ('' = all). Daily submissions follow it; its status bar is highlighted. */
  status: string
}

const DAY_COLORS = ['#0B84CE', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444']

/** Fixed categories, so the chart keeps its shape when a status has no applications. */
const STATUS_BARS: { status: string; label: string }[] = [
  { status: 'submitted', label: 'Submitted' },
  { status: 'under_review', label: 'Review' },
  { status: 'approved', label: 'Approved' },
  { status: 'disbursed', label: 'Disbursed' },
  { status: 'rejected', label: 'Rejected' },
]

const STATUS_COLORS: Record<string, string> = {
  under_review: '#f59e0b',
  submitted: '#0B84CE',
  approved: '#22c55e',
  disbursed: '#14b8a6',
  rejected: '#ef4444',
  draft: '#94a3b8',
}

const submissionsConfig = {
  count: { label: 'Applications', color: '#0B84CE' },
} satisfies ChartConfig

const statusConfig = {
  count: { label: 'Count', color: '#8b5cf6' },
} satisfies ChartConfig

function last7DayKeys(): { label: string; idx: number }[] {
  const days: { label: string; idx: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push({
      label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      idx: 6 - i,
    })
  }
  return days
}

export function LoanQueueCharts({ applications, status }: LoanQueueChartsProps) {
  const inView = useMemo(
    () => (status ? applications.filter((a) => a.status === status) : applications),
    [applications, status],
  )
  const { dailyBars, statusBars, trendPct } = useMemo(() => {
    const keys = last7DayKeys()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dailyBars = keys.map(({ label, idx }) => {
      const dayStart = new Date(today)
      dayStart.setDate(dayStart.getDate() - (6 - idx))
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const count = inView.filter((a) => {
        const ts = a.submitted_at ?? a.created_at
        if (!ts) return false
        const d = new Date(ts)
        return d >= dayStart && d < dayEnd
      }).length

      return { day: label, count, fill: DAY_COLORS[idx % DAY_COLORS.length] }
    })

    const statusCounts: Record<string, number> = {}
    for (const app of applications) {
      statusCounts[app.status] = (statusCounts[app.status] ?? 0) + 1
    }
    const statusBars = STATUS_BARS.map((bar) => ({
      status: bar.label,
      count: statusCounts[bar.status] ?? 0,
      // The selected tab's bar keeps its colour; the others fade back.
      fill: STATUS_COLORS[bar.status] ?? '#64748b',
      opacity: !status || status === bar.status ? 1 : 0.25,
    }))

    const firstHalf = dailyBars.slice(0, 3).reduce((s, b) => s + b.count, 0)
    const secondHalf = dailyBars.slice(4).reduce((s, b) => s + b.count, 0)
    const pct =
      firstHalf === 0 ? (secondHalf > 0 ? 100 : 0) : Math.round(((secondHalf - firstHalf) / firstHalf) * 100)

    return { dailyBars, statusBars, trendPct: pct }
  }, [applications, inView, status])

  const up = trendPct >= 0

  return (
    <div className="grid lg:grid-cols-2 gap-3 mb-5">
      <Card className="overflow-hidden">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            Daily submissions
            <Badge
              variant="outline"
              className={clsxBadge(up)}
            >
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>{up ? '+' : ''}{trendPct}%</span>
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Last 7 days{status ? ` · ${STATUS_BARS.find((b) => b.status === status)?.label ?? status.replace(/_/g, ' ')}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 pb-3 pt-0">
          <ChartContainer config={submissionsConfig} className="h-[110px] min-h-0 aspect-auto w-full">
            <BarChart data={dailyBars} margin={{ left: -20, right: 4, top: 4, bottom: 0 }} barCategoryGap="20%">
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={4} fontSize={10} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} fontSize={10} />
              <ChartTooltip cursor={{ fill: 'rgba(11,132,206,0.08)' }} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {dailyBars.map((entry) => (
                  <Cell key={entry.day} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">By status</CardTitle>
          <CardDescription className="text-xs">
            {inView.length} app{inView.length === 1 ? '' : 's'} · {formatNaira(
              inView.reduce((s, a) => s + (parseFloat(a.requested_amount ?? '0') || 0), 0),
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 pb-3 pt-0">
          <ChartContainer config={statusConfig} className="h-[110px] min-h-0 aspect-auto w-full">
            <BarChart data={statusBars} margin={{ left: -20, right: 4, top: 4, bottom: 0 }} barCategoryGap="25%">
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="status"
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                fontSize={9}
                interval={0}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} fontSize={10} />
              <ChartTooltip cursor={{ fill: 'rgba(139,92,246,0.08)' }} content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {statusBars.map((entry) => (
                  <Cell key={entry.status} fill={entry.fill} fillOpacity={entry.opacity} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}

function clsxBadge(up: boolean) {
  return up
    ? 'text-emerald-600 bg-emerald-50 border-emerald-200 gap-1 text-[10px] py-0'
    : 'text-rose-600 bg-rose-50 border-rose-200 gap-1 text-[10px] py-0'
}
