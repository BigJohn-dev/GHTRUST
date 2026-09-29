import { describe, expect, it } from '@jest/globals';
import type { ScheduleItem } from '@/api/types';

import { MIN_WITHDRAWAL, nextInstallment, repaymentAmount, repaymentError, walletShortfall, withdrawalError } from '../loans';

const line = (installment: number, status: string, amount_due: string) =>
  ({ installment, status, amount_due, due_date: '2026-10-01', amount: amount_due }) as unknown as ScheduleItem;

const loan = {
  outstanding: '370000.00',
  schedule: [line(1, 'paid', '0.00'), line(2, 'partial', '23333.33'), line(3, 'pending', '123333.33')],
};

describe('nextInstallment', () => {
  it('is the oldest one not fully paid', () => {
    expect(nextInstallment(loan.schedule)?.installment).toBe(2);
    expect(nextInstallment([line(1, 'paid', '0')])).toBeUndefined();
  });
});

describe('repaymentAmount', () => {
  it('uses what is left on the next installment', () => {
    expect(repaymentAmount('next', loan, '')).toBe(23333.33);
  });
  it('uses the whole balance to pay off', () => {
    expect(repaymentAmount('all', loan, '')).toBe(370000);
  });
  it('uses the typed amount', () => {
    expect(repaymentAmount('custom', loan, '5000')).toBe(5000);
    expect(repaymentAmount('custom', loan, '')).toBe(0);
  });
  it('is 0 while the loan loads', () => {
    expect(repaymentAmount('all', undefined, '')).toBe(0);
  });
});

describe('repaymentError', () => {
  it('asks for an amount when a custom one is zero', () => {
    expect(repaymentError('custom', '0', 0, 370000)).toBe('Enter an amount.');
  });
  it('stops paying more than is owed', () => {
    expect(repaymentError('custom', '400000', 400000, 370000)).toBe('You only owe ₦370,000.');
  });
  it('allows paying exactly what is owed', () => {
    expect(repaymentError('all', '', 370000, 370000)).toBeNull();
  });
});

describe('walletShortfall', () => {
  it('rounds the top-up up to whole naira', () => {
    expect(walletShortfall(23333.33, 20000)).toBe(3334);
    expect(walletShortfall(1000, 5000)).toBe(0);
  });
});

describe('withdrawalError', () => {
  it('enforces the minimum', () => {
    expect(withdrawalError('50', 10000)).toBe(`The least you can withdraw is ₦${MIN_WITHDRAWAL}.`);
  });
  it('stops withdrawing more than the balance', () => {
    expect(withdrawalError('30000', 25000.5)).toBe('You have ₦25,000.50 available.');
  });
  it('allows the whole balance, and says nothing before typing', () => {
    expect(withdrawalError('25000', 25000)).toBeNull();
    expect(withdrawalError('', 25000)).toBeNull();
  });
});
