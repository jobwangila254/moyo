export const formatPhoneNumber = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    return '254' + cleaned.slice(1);
  }
  if (cleaned.startsWith('7')) {
    return '254' + cleaned;
  }
  if (cleaned.startsWith('254')) {
    return cleaned;
  }
  return cleaned;
};

export const validatePhoneNumber = (phone) => {
  const formatted = formatPhoneNumber(phone);
  return formatted.length === 12 && formatted.startsWith('254');
};

export const MATCH_UNLOCK_AMOUNT = 50;
export const SUBSCRIPTION_AMOUNT = 500;

export const PAYMENT_OPTIONS = {
  match_unlock: { amount: MATCH_UNLOCK_AMOUNT, label: 'Unlock Match', description: 'Unlimited messaging for this match' },
  subscription: { amount: SUBSCRIPTION_AMOUNT, label: 'Premium Subscription', description: 'See profiles from all counties + unlimited messages' },
};
