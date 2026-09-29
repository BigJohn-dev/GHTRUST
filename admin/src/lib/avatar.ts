/** Avatar colours staff can pick (same ids as the backend's AVATAR_COLORS). */
export const AVATAR_COLORS: { id: string; label: string; className: string }[] = [
  { id: 'navy', label: 'Navy', className: 'bg-[#1b2f6b]' },
  { id: 'cyan', label: 'Sky blue', className: 'bg-[#2fa4d7]' },
  { id: 'emerald', label: 'Green', className: 'bg-emerald-600' },
  { id: 'amber', label: 'Amber', className: 'bg-amber-500' },
  { id: 'rose', label: 'Rose', className: 'bg-rose-500' },
  { id: 'violet', label: 'Violet', className: 'bg-violet-600' },
  { id: 'slate', label: 'Slate', className: 'bg-slate-600' },
]

export function avatarClass(id: string | null | undefined): string {
  return (AVATAR_COLORS.find((c) => c.id === id) ?? AVATAR_COLORS[0]).className
}
