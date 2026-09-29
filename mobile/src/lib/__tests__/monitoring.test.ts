import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockCaptureException = jest.fn();
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  wrap: (c: unknown) => c,
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

// The DSN is read when the module loads, so load it (and the ApiError class it checks
// against) fresh with one set.
function load() {
  process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@o1.ingest.sentry.io/1';
  let mod!: typeof import('../monitoring') & typeof import('@/api/errors');
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    mod = { ...require('../monitoring'), ...require('@/api/errors') };
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
  return mod;
}

describe('reportError', () => {
  beforeEach(() => {
    mockCaptureException.mockClear();
  });

  it('reports server errors tagged with the request ID', () => {
    const { reportError, monitoringEnabled, ApiError } = load();
    expect(monitoringEnabled).toBe(true);
    reportError(new ApiError(502, 'PAYMENT_PROVIDER_ERROR', 'x', [], 'req-123'), { path: '/wallet/withdraw' });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [, hint] = mockCaptureException.mock.calls[0] as [unknown, { tags: Record<string, string> }];
    expect(hint.tags).toMatchObject({
      request_id: 'req-123',
      api_code: 'PAYMENT_PROVIDER_ERROR',
      api_status: '502',
      path: '/wallet/withdraw',
    });
  });

  it("doesn't report expected failures", () => {
    const { reportError, ApiError } = load();
    reportError(new ApiError(401, 'TRANSACTION_PIN_INVALID', 'x'));
    reportError(new ApiError(0, 'NETWORK', 'x'));
    reportError(new ApiError(0, 'TIMEOUT', 'x'));
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('reports app exceptions', () => {
    const { reportError } = load();
    reportError(new TypeError('undefined is not a function'), { where: 'screen' });
    expect(mockCaptureException).toHaveBeenCalledWith(expect.any(TypeError), { tags: { where: 'screen' } });
  });
});
