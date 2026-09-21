export const dashboardStats = {
  loanBook: 48_750_000,
  loanBookChange: 8.4,
  totalDisbursed: 12_300_000,
  disbursedChange: 12.1,
  totalRepaid: 9_850_000,
  repaidChange: 5.6,
  pendingApplications: 14,
  overdueLoans: 6,
}

export const pendingReviews = [
  {
    id: 'app-001',
    name: 'Business Loan — Emeka Nwosu',
    saved: 450_000,
    target: 2_000_000,
    progress: 22,
  },
  {
    id: 'app-002',
    name: 'Payday Loan — Fatima Abdullahi',
    saved: 80_000,
    target: 150_000,
    progress: 53,
  },
  {
    id: 'app-003',
    name: 'Study Loan — Ibrahim Musa',
    saved: 1_200_000,
    target: 4_200_000,
    progress: 29,
  },
]

export const spendingBreakdown = [
  { label: 'Business', value: 52, color: '#1B2F6B' },
  { label: 'Payday', value: 28, color: '#2FA4D7' },
  { label: 'Study & Asset', value: 20, color: '#94A3B8' },
]

export const recentApplications = [
  {
    id: 'LA-2401',
    name: 'Adaeze Okafor',
    type: 'Business Loan',
    date: '15 Jul 2026, 09:42',
    amount: 1_500_000,
    status: 'under_review' as const,
  },
  {
    id: 'LA-2402',
    name: 'Chukwuma Eze',
    type: 'Payday Loan',
    date: '15 Jul 2026, 08:15',
    amount: 120_000,
    status: 'submitted' as const,
  },
  {
    id: 'LA-2403',
    name: 'Grace Adeyemi',
    type: 'Study Loan',
    date: '14 Jul 2026, 16:30',
    amount: 3_800_000,
    status: 'approved' as const,
  },
  {
    id: 'LA-2404',
    name: 'Tunde Bakare',
    type: 'Asset Loan',
    date: '14 Jul 2026, 11:05',
    amount: 2_100_000,
    status: 'completed' as const,
  },
  {
    id: 'LA-2405',
    name: 'Ngozi Okonkwo',
    type: 'Business Loan',
    date: '13 Jul 2026, 14:22',
    amount: 950_000,
    status: 'rejected' as const,
  },
]

export function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount)
}
