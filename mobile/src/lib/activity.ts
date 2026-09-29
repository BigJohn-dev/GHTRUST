import type Ionicons from '@expo/vector-icons/Ionicons';

import type { ApplicationSummary, Loan } from '@/api/types';

import { productName } from '@/components/loans';
import { applicationStatus, loanStatus, type Tone } from './status';

/** One row of "Recent activity" on the home screen. */
export type Activity = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  amount: string | null;
  /** Money coming to the customer shows in green with a plus. */
  direction: 'in' | 'out' | 'none';
  status: { label: string; tone: Tone };
  at: string;
  href: `/loans/${string}` | `/applications/${string}` | `/apply/${string}`;
};

/**
 * The customer's latest loan events, newest first. Built from data the home screen already
 * loads (no extra request), until the wallet has its own transaction history endpoint.
 */
export function recentActivity(loans: Loan[], applications: ApplicationSummary[], limit = 5): Activity[] {
  const items: Activity[] = [];

  for (const loan of loans) {
    const s = loanStatus(loan.status);
    items.push({
      id: `loan-${loan.id}`,
      icon: loan.status === 'overdue' ? 'alert-circle' : loan.status === 'active' ? 'cash' : 'checkmark-done',
      title: productName(loan.product_type),
      subtitle: 'Paid out',
      amount: loan.principal,
      direction: 'in',
      status: { label: s.label, tone: s.tone },
      at: loan.disbursement_date ?? loan.created_at,
      href: `/loans/${loan.id}`,
    });
  }

  for (const app of applications) {
    // A paid-out application already shows as its loan.
    if (app.status === 'disbursed') continue;
    const s = applicationStatus(app.status);
    const draft = app.status === 'draft';
    items.push({
      id: `app-${app.id}`,
      icon: draft ? 'create' : 'document-text',
      // Titles stay short so they fit narrow phones; the badge carries the state.
      title: app.product_name,
      subtitle: draft ? 'Tap to finish' : 'Application',
      amount: app.approved_amount ?? app.requested_amount,
      direction: 'none',
      status: { label: s.label, tone: s.tone },
      at: app.submitted_at ?? app.created_at,
      href: draft ? `/apply/${app.id}` : `/applications/${app.id}`,
    });
  }

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** "Today", "Yesterday", "3 days ago", else "12 Aug". */
export function activityWhen(value: string, now = new Date()): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}
