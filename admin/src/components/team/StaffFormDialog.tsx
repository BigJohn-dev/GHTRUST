import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { ApiError } from '../../lib/api'
import type { Role, StaffCreateInput, StaffMember, StaffUpdateInput } from '../../lib/teamApi'

interface StaffFormDialogProps {
  open: boolean
  onClose: () => void
  roles: Role[]
  initial?: StaffMember | null
  onSubmit: (data: StaffCreateInput | StaffUpdateInput) => Promise<void>
}

export function StaffFormDialog({ open, onClose, roles, initial, onSubmit }: StaffFormDialogProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [roleId, setRoleId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setFullName(initial?.full_name ?? '')
    setEmail(initial?.email ?? '')
    setPhone('')
    setRoleId(initial?.role?.id ?? '')
    setError('')
  }, [open, initial])

  if (!open) return null

  const isEdit = !!initial

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (isEdit) {
        const payload: StaffUpdateInput = {
          full_name: fullName.trim(),
          email: email.trim(),
        }
        if (phone.trim()) payload.phone = phone.trim()
        if (roleId) payload.role_id = roleId
        await onSubmit(payload)
      } else {
        await onSubmit({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role_id: roleId || null,
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
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {isEdit ? 'Edit team member' : 'Add team member'}
            </h3>
            <p className="text-[12px] text-slate-400 mt-0.5">
              {isEdit ? 'Update profile and role assignment' : 'New members start inactive until activated'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Full name</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1.5 w-full text-[13px] ring-1 ring-slate-200 rounded-lg px-3 py-2.5 outline-none focus:ring-[#1b2f6b]/30"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full text-[13px] ring-1 ring-slate-200 rounded-lg px-3 py-2.5 outline-none focus:ring-[#1b2f6b]/30"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Phone {isEdit && <span className="normal-case font-normal text-slate-400">(leave blank to keep {initial?.phone})</span>}
            </label>
            <input
              required={!isEdit}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1.5 w-full text-[13px] ring-1 ring-slate-200 rounded-lg px-3 py-2.5 outline-none focus:ring-[#1b2f6b]/30"
              placeholder="08123456789"
            />
          </div>
          {!initial?.is_super_admin && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Role</label>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="mt-1.5 w-full text-[13px] ring-1 ring-slate-200 rounded-lg px-3 py-2.5 bg-white outline-none focus:ring-[#1b2f6b]/30"
              >
                <option value="">Select role…</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-[13px] text-rose-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={clsx(
                'flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-white bg-[#1b2f6b] hover:bg-[#141f45] disabled:opacity-50',
              )}
            >
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
