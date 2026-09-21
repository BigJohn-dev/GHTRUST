import clsx from 'clsx'
import { Check, Circle, X } from 'lucide-react'

export interface PipelineStage {
  name: string
  status: 'completed' | 'current' | 'upcoming' | 'rejected'
  approver_role_name?: string | null
  sort_order?: number
}

interface WorkflowPipelineProps {
  stages: PipelineStage[]
  compact?: boolean
  className?: string
}

const statusStyles = {
  completed: {
    dot: 'bg-emerald-500 text-white ring-emerald-200',
    label: 'text-emerald-800',
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
  },
  current: {
    dot: 'bg-[#1b2f6b] text-white ring-[#1b2f6b]/30 shadow-md shadow-[#1b2f6b]/20',
    label: 'text-[#1b2f6b] font-bold',
    pill: 'bg-[#1b2f6b]/10 text-[#1b2f6b] ring-[#1b2f6b]/20',
  },
  upcoming: {
    dot: 'bg-slate-100 text-slate-400 ring-slate-200',
    label: 'text-slate-400',
    pill: 'bg-slate-50 text-slate-400 ring-slate-200/80',
  },
  rejected: {
    dot: 'bg-rose-500 text-white ring-rose-200',
    label: 'text-rose-700 font-bold',
    pill: 'bg-rose-50 text-rose-700 ring-rose-200/80',
  },
} as const

export function WorkflowPipeline({ stages, compact = false, className }: WorkflowPipelineProps) {
  if (!stages.length) return null

  if (compact) {
    return (
      <div className={clsx('flex items-center gap-0.5', className)}>
        {stages.map((stage, i) => (
          <div key={`${stage.name}-${i}`} className="flex items-center">
            <div
              title={stage.name}
              className={clsx(
                'h-2 w-2 rounded-full shrink-0',
                stage.status === 'completed' && 'bg-emerald-500',
                stage.status === 'current' && 'bg-[#1b2f6b] ring-2 ring-[#1b2f6b]/25',
                stage.status === 'upcoming' && 'bg-slate-200',
                stage.status === 'rejected' && 'bg-rose-500',
              )}
            />
            {i < stages.length - 1 && (
              <div
                className={clsx(
                  'h-0.5 w-3 mx-0.5',
                  stage.status === 'completed' ? 'bg-emerald-400' : 'bg-slate-200',
                )}
              />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={clsx('w-full overflow-x-auto pb-1', className)}>
      <div className="flex items-start min-w-max px-1">
        {stages.map((stage, i) => {
          const styles = statusStyles[stage.status]
          const isLast = i === stages.length - 1
          const prevCompleted = i > 0 && stages[i - 1].status === 'completed'

          return (
            <div key={`${stage.name}-${i}`} className="flex items-start flex-1 min-w-[120px] max-w-[180px]">
              <div className="flex flex-col items-center w-full">
                <div className="flex items-center w-full">
                  {i > 0 && (
                    <div
                      className={clsx(
                        'h-0.5 flex-1 -mr-1',
                        prevCompleted ? 'bg-emerald-400' : 'bg-slate-200',
                      )}
                    />
                  )}
                  <div
                    className={clsx(
                      'relative z-10 flex h-9 w-9 items-center justify-center rounded-full ring-2 shrink-0',
                      styles.dot,
                    )}
                  >
                    {stage.status === 'completed' && <Check className="h-4 w-4" strokeWidth={3} />}
                    {stage.status === 'rejected' && <X className="h-4 w-4" strokeWidth={3} />}
                    {stage.status === 'current' && (
                      <span className="absolute -inset-1 rounded-full bg-[#1b2f6b]/15 animate-pulse" />
                    )}
                    {stage.status === 'current' && <Circle className="h-2.5 w-2.5 fill-current relative z-10" />}
                    {stage.status === 'upcoming' && <span className="h-2 w-2 rounded-full bg-slate-300" />}
                  </div>
                  {!isLast && (
                    <div
                      className={clsx(
                        'h-0.5 flex-1 -ml-1',
                        stage.status === 'completed' ? 'bg-emerald-400' : 'bg-slate-200',
                      )}
                    />
                  )}
                </div>

                <div className="mt-3 text-center px-1 w-full">
                  <p className={clsx('text-[11px] leading-tight line-clamp-2', styles.label)}>
                    {stage.name}
                  </p>
                  {stage.status === 'current' && (
                    <span className={clsx('inline-block mt-1.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded', styles.pill)}>
                      Current
                    </span>
                  )}
                  {stage.status === 'completed' && (
                    <span className="inline-block mt-1.5 text-[9px] font-semibold text-emerald-600 uppercase tracking-wide">
                      Done
                    </span>
                  )}
                  {stage.status === 'rejected' && (
                    <span className={clsx('inline-block mt-1.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded', styles.pill)}>
                      Rejected
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
