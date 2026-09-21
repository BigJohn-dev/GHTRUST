import clsx from 'clsx'
import { permissionLabel } from '../../lib/permissions'

interface PermissionMatrixProps {
  groups: { label: string; permissions: string[] }[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  disabled?: boolean
}

export function PermissionMatrix({ groups, selected, onChange, disabled }: PermissionMatrixProps) {
  const toggle = (key: string) => {
    if (disabled) return
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange(next)
  }

  const toggleGroup = (keys: string[]) => {
    if (disabled) return
    const allOn = keys.every((k) => selected.has(k))
    const next = new Set(selected)
    for (const k of keys) {
      if (allOn) next.delete(k)
      else next.add(k)
    }
    onChange(next)
  }

  return (
    <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
      {groups.map((group) => {
        const keys = group.permissions
        const allOn = keys.every((k) => selected.has(k))
        const someOn = keys.some((k) => selected.has(k))
        return (
          <div key={group.label} className="rounded-xl border border-slate-200/90 overflow-hidden">
            <button
              type="button"
              disabled={disabled}
              onClick={() => toggleGroup(keys)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left disabled:opacity-60"
            >
              <span className="text-[12px] font-bold uppercase tracking-wide text-slate-700">
                {group.label}
              </span>
              <span
                className={clsx(
                  'text-[10px] font-semibold px-2 py-0.5 rounded-md',
                  allOn ? 'bg-emerald-100 text-emerald-700' : someOn ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500',
                )}
              >
                {allOn ? 'All' : someOn ? 'Partial' : 'None'}
              </span>
            </button>
            <div className="p-3 grid sm:grid-cols-2 gap-2">
              {keys.map((key) => (
                <label
                  key={key}
                  className={clsx(
                    'flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors',
                    selected.has(key) ? 'bg-sky-50 ring-1 ring-sky-200/80' : 'hover:bg-slate-50',
                    disabled && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(key)}
                    disabled={disabled}
                    onChange={() => toggle(key)}
                    className="mt-0.5 rounded border-slate-300 text-[#1b2f6b] focus:ring-[#1b2f6b]/30"
                  />
                  <div>
                    <p className="text-[13px] font-medium text-slate-800">{permissionLabel(key)}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{key}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
