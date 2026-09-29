import type { ScheduleItem } from '@/api/types';

import { naira } from './format';

/** The oldest installment not fully paid: what "next payment" means everywhere. */
export const nextInstallment = (schedule: ScheduleItem[]) => schedule.find((s) => s.status !== 'paid');

export type RepayChoice = 'next' | 'all' | 'custom';

/** The amount a repayment choice stands for, in naira (a number, from the API's decimal strings). */
export function repaymentAmount(
  choice: RepayChoice,
  loan: { outstanding: string; schedule: ScheduleItem[] } | undefined,
  custom: string,
): number {
  if (!loan) return 0;
  const raw =
    choice === 'next' ? (nextInstallment(loan.schedule)?.amount_due ?? '0') : choice === 'all' ? loan.outstanding : custom || '0';
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

/** Why a repayment amount can't be paid, or null. */
export function repaymentError(choice: RepayChoice, custom: string, value: number, outstanding: number): string | null {
  if (choice === 'custom' && custom && value <= 0) return 'Enter an amount.';
  if (value > outstanding) return `You only owe ${naira(outstanding)}.`;
  return null;
}

/** How much more the wallet needs for a payment (whole naira, rounded up), or 0. */
export const walletShortfall = (value: number, balance: number) => (value > balance ? Math.ceil(value - balance) : 0);

export const MIN_WITHDRAWAL = 100;

/** Why a withdrawal amount can't be sent, or null. `amount` is the digits typed. */
export function withdrawalError(amount: string, balance: number): string | null {
  const value = Number(amount || 0);
  if (amount && value < MIN_WITHDRAWAL) return `The least you can withdraw is ${naira(MIN_WITHDRAWAL)}.`;
  if (value > balance) return `You have ${naira(balance, { kobo: true })} available.`;
  return null;
}
