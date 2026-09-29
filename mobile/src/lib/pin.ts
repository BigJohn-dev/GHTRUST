/**
 * Quick on-phone check for PINs that are too easy to guess, so the customer hears about
 * it before confirming. The server applies the same rules (plus date of birth).
 */
export function weakPinReason(pin: string): string | null {
  if (new Set(pin).size === 1) return 'Avoid repeating one digit, like 1111.';
  const steps = new Set([...pin].slice(1).map((c, i) => Number(c) - Number(pin[i])));
  if (steps.size === 1 && (steps.has(1) || steps.has(-1))) return 'Avoid counting up or down, like 1234.';
  if (pin.length >= 6 && new Set(pin).size <= 2) return 'Use more than two different digits.';
  return null;
}
