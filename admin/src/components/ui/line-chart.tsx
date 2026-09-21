import * as React from 'react'
import * as RechartsPrimitive from 'recharts'
import { cn } from '../../lib/utils'

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    color?: string
  }
}

type ChartContextProps = { config: ChartConfig }

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) throw new Error('useChart must be used within a ChartContainer')
  return context
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children']
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          'flex aspect-[2/1] min-h-[180px] w-full justify-center text-xs [&_.recharts-cartesian-grid_line]:stroke-slate-200/80 [&_.recharts-dot]:stroke-transparent',
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const entries = Object.entries(config).filter(([, c]) => c.color)
  if (!entries.length) return null
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart=${id}] { ${entries.map(([key, item]) => `--color-${key}: ${item.color};`).join(' ')} }`,
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({
  active,
  payload,
  label,
  hideLabel = false,
}: {
  active?: boolean
  payload?: Array<{ dataKey?: string | number; name?: string; value?: number; color?: string }>
  label?: string | number
  hideLabel?: boolean
}) {
  const { config } = useChart()
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {!hideLabel && label != null && (
        <p className="font-medium text-slate-900 mb-1">{String(label)}</p>
      )}
      {payload.map((item) => {
        const key = String(item.dataKey ?? 'value')
        const itemConfig = config[key]
        return (
          <div key={key} className="flex items-center gap-2 text-slate-600">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color ?? itemConfig?.color }}
            />
            <span>{itemConfig?.label ?? key}</span>
            <span className="font-semibold text-slate-900 tabular-nums ml-auto">
              {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartStyle }
