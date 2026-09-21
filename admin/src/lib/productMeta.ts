import { Briefcase, Car, GraduationCap, Wallet, type LucideIcon } from 'lucide-react'

export interface ProductMeta {
  label: string
  icon: LucideIcon
  /** Muted professional accent — navy/slate only */
  accent: string
  soft: string
  border: string
}

const DEFAULT: ProductMeta = {
  label: 'Loan',
  icon: Wallet,
  accent: 'text-slate-700',
  soft: 'bg-slate-100',
  border: 'border-slate-200',
}

export const PRODUCT_META: Record<string, ProductMeta> = {
  business_loan: {
    label: 'Business',
    icon: Briefcase,
    accent: 'text-[#1b2f6b]',
    soft: 'bg-slate-100',
    border: 'border-slate-200',
  },
  payday_loan: {
    label: 'Payday',
    icon: Wallet,
    accent: 'text-slate-700',
    soft: 'bg-slate-50',
    border: 'border-slate-200',
  },
  study_loan: {
    label: 'Study',
    icon: GraduationCap,
    accent: 'text-[#1b2f6b]',
    soft: 'bg-slate-100',
    border: 'border-slate-200',
  },
  asset_loan: {
    label: 'Asset',
    icon: Car,
    accent: 'text-slate-700',
    soft: 'bg-slate-50',
    border: 'border-slate-200',
  },
}

export function getProductMeta(code: string): ProductMeta {
  return PRODUCT_META[code] ?? DEFAULT
}

export function initials(name: string | null | undefined): string {
  if (!name?.trim()) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
