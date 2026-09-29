import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { ApiError, messageFor, waitPhrase } from '../errors';

// messageFor logs details for developers; keep test output clean.
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

const err = (code: string, status = 400, details: Record<string, unknown>[] = []) =>
  new ApiError(status, code, 'server detail meant for developers', [], 'req-1', undefined, details);

describe('messageFor', () => {
  it('never shows server wording to customers', () => {
    const text = messageFor(err('PHONE_IN_USE', 409));
    expect(text).toBe('This account already exists. Sign in instead.');
    expect(text).not.toContain('developers');
  });
  it('adds the tries left on a wrong PIN', () => {
    expect(messageFor(err('TRANSACTION_PIN_INVALID', 401, [{ attempts_left: 2 }]))).toBe(
      "That transaction PIN isn't right. 2 tries left.",
    );
    expect(messageFor(err('TRANSACTION_PIN_INVALID', 401, [{ attempts_left: 1 }]))).toMatch(/1 try left\.$/);
  });
  it('has wording for the money and offer errors', () => {
    expect(messageFor(err('INSUFFICIENT_FUNDS', 409))).toMatch(/wallet balance isn't enough/);
    expect(messageFor(err('PAYOUT_ACCOUNT_REQUIRED', 409))).toMatch(/bank account/);
    expect(messageFor(err('OFFER_CHANGED', 409))).toMatch(/offer has changed/);
  });
  it('explains a selfie cooldown with the wait', () => {
    const text = messageFor(err('SELFIE_COOLDOWN', 429, [{ retry_after: 600 }]));
    expect(text).toMatch(/try again in 10 minutes\.$/);
  });
  it('falls back safely for unknown codes and non-API errors', () => {
    expect(messageFor(err('SOMETHING_NEW', 418))).toBeTruthy();
    expect(messageFor(new TypeError('boom'))).toBe('Something went wrong. Please try again.');
    expect(messageFor(undefined, 'Custom fallback')).toBe('Custom fallback');
  });
});

describe('waitPhrase', () => {
  it('rounds up to whole minutes', () => {
    expect(waitPhrase(1)).toBe('in 1 minute');
    expect(waitPhrase(61)).toBe('in 2 minutes');
    expect(waitPhrase(59 * 60)).toBe('in 59 minutes');
  });
  it('switches to a clock time for long waits', () => {
    expect(waitPhrase(3 * 3600)).toMatch(/^after /);
  });
});
