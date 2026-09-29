/**
 * The OTP step in progress. Kept in memory, not in route params, so a BVN or
 * phone number never ends up in a URL, deep link or navigation log.
 */
type Common = {
  phoneMasked: string;
  expiresIn: number;
  /** Test mode only (dev build + backend in development with mocked SMS). */
  devCode?: string | null;
};

export type PendingOtp = ({ mode: 'register'; bvn: string } | { mode: 'login'; phone: string }) & Common;

/** The server only echoes codes in local development; the app only uses them in dev builds. */
export const testModeCode = (code: string | null | undefined) => (__DEV__ && code ? code : null);

let pending: PendingOtp | null = null;

export const pendingOtp = {
  get: () => pending,
  set: (value: PendingOtp) => {
    pending = value;
  },
  clear: () => {
    pending = null;
  },
};

/** A sign-in on this (new) phone waiting for approval on the customer's other phone. */
export type PendingApproval = {
  id: string;
  secret: string;
  approverDevices: string[];
  fallbackNeedsPin: boolean;
  expiresAt: number;
};

let approval: PendingApproval | null = null;

export const pendingApproval = {
  get: () => approval,
  set: (value: PendingApproval) => {
    approval = value;
  },
  clear: () => {
    approval = null;
  },
};

/** Sign-up waiting for a selfie that matches the BVN photo (after the SMS code). */
export type PendingSelfie = { token: string; firstName: string; attemptsLeft: number; expiresAt: number };

let selfie: PendingSelfie | null = null;

export const pendingSelfie = {
  get: () => selfie,
  set: (value: PendingSelfie) => {
    selfie = value;
  },
  clear: () => {
    selfie = null;
  },
};
