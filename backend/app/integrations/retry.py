"""
Retry policy shared by every external provider client.

Rules:
* Only *transient* failures are retried — network/transport errors and
  provider 5xx. A 4xx is the provider's answer (invalid BVN, closed account,
  insufficient settlement balance); retrying it wastes the request budget and
  cannot change the outcome.
* ``reraise=True``: once attempts are exhausted the ORIGINAL exception
  propagates. Without it tenacity raises ``tenacity.RetryError``, which is not a
  ``PaymentRailError``/``DojahError`` — every ``except PaymentRailError`` handler
  missed it and callers got an unhandled 500 with the provider's error code
  lost. That was the behaviour of all four original clients.

``TransientError`` doubles as a signal to callers: for a state-changing call
(initiate transfer) a transient failure means the outcome is UNKNOWN — the
provider may have accepted the request before the connection dropped. Money
movement code must not treat it as a definitive failure (see
DisbursementService / WalletService.process_withdrawal).
"""

from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential


class TransientError(Exception):
    """Marker mixin: transport failure or provider 5xx; outcome unknown."""


def transient_retry(attempts: int = 2):
    return retry(
        stop=stop_after_attempt(attempts),
        wait=wait_exponential(min=1, max=4),
        retry=retry_if_exception_type(TransientError),
        reraise=True,
    )


def is_transient(exc: BaseException) -> bool:
    return isinstance(exc, TransientError)
