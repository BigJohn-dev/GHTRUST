import type Ionicons from '@expo/vector-icons/Ionicons';

import type { TicketCategory } from '@/api/types';

import type { Tone } from './status';

export const CATEGORY: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; hint: string }> = {
  payments: { label: 'Payments', icon: 'swap-vertical', hint: 'Money in or out, repayments, the wallet' },
  loans: { label: 'Loans', icon: 'document-text', hint: 'Applications, offers, schedules' },
  account: { label: 'Account', icon: 'person-circle', hint: 'Signing in, PINs, phones, your details' },
  app: { label: 'App problem', icon: 'bug', hint: "Something isn't working" },
  data: { label: 'My data', icon: 'lock-closed', hint: 'See, correct or delete your information' },
  other: { label: 'Something else', icon: 'chatbubbles', hint: 'Anything else' },
};

export const CATEGORY_ORDER: TicketCategory[] = ['payments', 'loans', 'account', 'app', 'data', 'other'];

const STATUS: Record<string, { label: string; tone: Tone }> = {
  open: { label: 'Received', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'progress' },
  resolved: { label: 'Resolved', tone: 'success' },
};

export const ticketStatus = (s: string) => STATUS[s] ?? { label: s, tone: 'neutral' as Tone };
