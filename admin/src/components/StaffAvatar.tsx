import clsx from 'clsx'
import type { StaffProfile } from '../lib/api'
import { AVATAR_COLORS, avatarClass } from '../lib/avatar'

/** Initials on the colour the staff member picked on their profile. */
export function StaffAvatar({
  staff,
  size = 'md',
  className,
}: {
  staff: Pick<StaffProfile, 'full_name' | 'avatar_color'> | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const name = staff?.full_name?.trim() || 'Staff'
  const parts = name.split(/\s+/)
  const initials = (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
  return (
    <div
      aria-hidden
      className={clsx(
        'rounded-lg flex items-center justify-center font-bold text-white shrink-0 select-none',
        avatarClass(staff?.avatar_color ?? AVATAR_COLORS[0].id),
        size === 'sm' && 'h-9 w-9 text-[11px]',
        size === 'md' && 'h-11 w-11 text-[13px]',
        size === 'lg' && 'h-20 w-20 text-2xl rounded-2xl',
        className,
      )}
    >
      {initials}
    </div>
  )
}
