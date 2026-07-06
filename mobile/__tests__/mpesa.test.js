const { formatPhoneNumber, validatePhoneNumber, MATCH_UNLOCK_AMOUNT, PAYMENT_OPTIONS } = require('../src/services/mpesa');

describe('M-Pesa Utilities', () => {
  describe('formatPhoneNumber', () => {
    it('converts 0-prefixed number to 254 format', () => {
      expect(formatPhoneNumber('0712345678')).toBe('254712345678');
    });

    it('converts 7-prefixed number to 254 format', () => {
      expect(formatPhoneNumber('712345678')).toBe('254712345678');
    });

    it('keeps 254-prefixed number as-is', () => {
      expect(formatPhoneNumber('254712345678')).toBe('254712345678');
    });

    it('strips non-digit characters', () => {
      expect(formatPhoneNumber('0712 345 678')).toBe('254712345678');
      expect(formatPhoneNumber('+254712345678')).toBe('254712345678');
    });
  });

  describe('validatePhoneNumber', () => {
    it('returns true for valid Kenyan numbers', () => {
      expect(validatePhoneNumber('0712345678')).toBe(true);
      expect(validatePhoneNumber('254712345678')).toBe(true);
    });

    it('returns false for invalid numbers', () => {
      expect(validatePhoneNumber('123')).toBe(false);
      expect(validatePhoneNumber('071234567')).toBe(false);
    });
  });

  describe('constants', () => {
    it('has correct constants', () => {
      expect(MATCH_UNLOCK_AMOUNT).toBe(10);
    });

    it('has correct premium subscription prices', () => {
      expect(PAYMENT_OPTIONS.daily_chat_unlock.amount).toBe(30);
      expect(PAYMENT_OPTIONS.subscription_weekly.amount).toBe(150);
      expect(PAYMENT_OPTIONS.subscription_fortnightly.amount).toBe(250);
      expect(PAYMENT_OPTIONS.subscription_monthly.amount).toBe(500);
      expect(PAYMENT_OPTIONS.subscription_halfyear.amount).toBe(2500);
      expect(PAYMENT_OPTIONS.subscription_yearly.amount).toBe(5000);
    });

    it('has match_unlock option', () => {
      expect(PAYMENT_OPTIONS.match_unlock.amount).toBe(10);
    });
  });
});
