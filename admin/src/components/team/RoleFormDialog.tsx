import { useEffect, useState } from 'react'
import { Lock, X } from 'lucide-react'
import { ApiError } from '../../lib/api'
import type { PermissionGroup, Role, RoleCreateInput, RoleUpdateInput } from '../../lib/teamApi'
import { PermissionMatrix } from './PermissionMatrix'

interface RoleFormDialogProps {
  open: boolean
  onClose: () => void
  permissionGroups: PermissionGroup[]
  initial?: Role | null
  onSubmit: (data: RoleCreateInput | RoleUpdateInput) => Promise<void>
}

export function RoleFormDialog({
  open,
  onClose,
  permissionGroups,
  initial,
  onSubmit,
}: RoleFormDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const readOnly = initial?.is_system ?? false

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setDescription(initial?.description ?? '')
    setSelected(new Set(initial?.permissions ?? []))
    setError('')
  }, [open, initial])

  if (!open) return null

  const isEdit = !!initial

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (readOnly) return
    setSaving(true)
    setError('')
    try {
      const perms = [...selected]
      if (isEdit) {
        await onSubmit({
          name: name.trim(),
          description: description.trim() || undefined,
          permissions: perms,
        })
      } else {
        await onSubmit({
          name: name.trim(),
          description: description.trim() || undefined,
          permissions: perms,
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              {isEdit ? 'Edit role' : 'Create role'}
              {readOnly && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                  <Lock className="h-3 w-3" /> System
                </span>
              )}
            </h3>
            <p className="text-[12px] text-slate-400 mt-0.5">Define access permissions for staff members</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Role name</label>
                <input
                  required
                  disabled={readOnly}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full text-[13px] ring-1 ring-slate-200 rounded-lg px-3 py-2.5 outline-none focus:ring-[#1b2f6b]/30 disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</label>
                <input
                  disabled={readOnly}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1.5 w-full text-[13px] ring-1 ring-slate-200 rounded-lg px-3 py-2.5 outline-none focus:ring-[#1b2f6b]/30 disabled:bg-slate-50"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Permissions</p>
              <PermissionMatrix
                groups={permissionGroups}
                selected={selected}
                onChange={setSelected}
                disabled={readOnly}
              />
            </div>

            {error && <p className="text-[13px] text-rose-600">{error}</p>}
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-white"
            >
              {readOnly ? 'Close' : 'Cancel'}
            </button>
            {!readOnly && (
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-white bg-[#1b2f6b] hover:bg-[#141f45] disabled:opacity-50"
              >
                {saving ? 'Saving…' : isEdit ? 'Save role' : 'Create role'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
