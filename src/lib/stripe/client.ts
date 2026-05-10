import Stripe from 'stripe';

// Lazily initialise Stripe so the module can be imported during the Next.js
// build even when STRIPE_SECRET_KEY is not present (e.g. CI / Vercel build
// phase). The key is always required at *runtime* for any actual API call.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is missing from environment variables. Add it in your Vercel project settings.');
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-04-10' as any,
      typescript: true,
    });
  }
  return _stripe;
}

// Backwards-compatible named export so existing callers still compile.
// They should switch to getStripe() for lazy evaluation.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop];
  },
});
