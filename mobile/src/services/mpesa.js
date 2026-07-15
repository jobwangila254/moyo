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

export const MATCH_UNLOCK_AMOUNT = 10;

export const LIKE_UNLOCK_AMOUNT = 20;

export const PAYMENT_OPTIONS = {
  like_unlock: { amount: LIKE_UNLOCK_AMOUNT, label: 'Like Back & Unlock', description: 'Like back and unlock unlimited messaging' },
  match_unlock: { amount: MATCH_UNLOCK_AMOUNT, label: 'Unlock Match', description: 'Unlimited messaging for this match' },
  daily_chat_unlock: { amount: 30, label: 'Daily Chat Unlimited', description: 'Unlimited chat for today — all matches' },
  subscription_weekly: { amount: 150, label: 'Weekly Premium', description: '1 week — see profiles from all counties' },
  subscription_fortnightly: { amount: 250, label: 'Fortnightly Premium', description: '2 weeks — see profiles from all counties' },
  subscription_monthly: { amount: 500, label: 'Monthly Premium', description: '1 month — unlimited access' },
  subscription_halfyear: { amount: 2500, label: '6 Months Premium', description: 'Half year — best value' },
  subscription_yearly: { amount: 5000, label: 'Yearly Premium', description: 'Full year — ultimate access' },
};
