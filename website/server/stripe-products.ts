/**
 * Stripe Products and Prices Configuration
 * These are the subscription plans available for bot licenses
 */

export const STRIPE_PRODUCTS = {
  BOT_LICENSE: {
    name: 'Bot License',
    description: 'Professional Discord Bot License',
  },
};

export const STRIPE_PRICES = {
  MONTHLY: {
    name: 'Monthly Plan',
    amount: 2999, // $29.99 in cents
    currency: 'usd',
    interval: 'month',
    intervalCount: 1,
    planType: 'monthly',
  },
  QUARTERLY: {
    name: 'Quarterly Plan',
    amount: 7999, // $79.99 in cents
    currency: 'usd',
    interval: 'month',
    intervalCount: 3,
    planType: 'quarterly',
  },
  SEMI_ANNUAL: {
    name: 'Semi-Annual Plan',
    amount: 14999, // $149.99 in cents
    currency: 'usd',
    interval: 'month',
    intervalCount: 6,
    planType: 'semi_annual',
  },
  ANNUAL: {
    name: 'Annual Plan',
    amount: 25999, // $259.99 in cents (saves $60 vs monthly)
    currency: 'usd',
    interval: 'year',
    intervalCount: 1,
    planType: 'annual',
  },
};

export function getPriceByPlanType(planType: string) {
  const priceMap: Record<string, (typeof STRIPE_PRICES)[keyof typeof STRIPE_PRICES]> = {
    monthly: STRIPE_PRICES.MONTHLY,
    quarterly: STRIPE_PRICES.QUARTERLY,
    semi_annual: STRIPE_PRICES.SEMI_ANNUAL,
    annual: STRIPE_PRICES.ANNUAL,
  };
  return priceMap[planType];
}

export function getPriceAmount(planType: string): number {
  const price = getPriceByPlanType(planType);
  return price ? price.amount : 0;
}

export function getPriceDescription(planType: string): string {
  const price = getPriceByPlanType(planType);
  return price ? price.name : 'Unknown Plan';
}
