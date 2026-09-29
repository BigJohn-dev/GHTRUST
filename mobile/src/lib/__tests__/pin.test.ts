import { describe, expect, it } from '@jest/globals';
import { weakPinReason } from '../pin';

describe('weakPinReason', () => {
  it.each(['1111', '000000', '999999'])('rejects a repeated digit: %s', (pin) => {
    expect(weakPinReason(pin)).toMatch(/repeating/);
  });
  it.each(['1234', '4321', '123456', '987654'])('rejects a sequence: %s', (pin) => {
    expect(weakPinReason(pin)).toMatch(/counting/);
  });
  it.each(['121212', '112211'])('rejects six digits built from two: %s', (pin) => {
    expect(weakPinReason(pin)).toMatch(/two different digits/);
  });
  it.each(['2580', '250817', '7391', '905173'])('accepts %s', (pin) => {
    expect(weakPinReason(pin)).toBeNull();
  });
});
