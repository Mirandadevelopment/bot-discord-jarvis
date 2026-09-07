import Stripe from 'stripe';
import { ENV } from './_core/env';
import * as db from './db';
import { getPriceByPlanType } from './stripe-products';

const stripe = new Stripe(ENV.stripeSecretKey);

export async function createCheckoutSession(
  userId: number,
  userEmail: string,
  userName: string,
  planType: string,
  origin: string,
) {
  const price = getPriceByPlanType(planType);
  if (!price) {
    throw new Error(`Invalid plan type: ${planType}`);
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    customer_email: userEmail,
    client_reference_id: userId.toString(),
    metadata: {
      user_id: userId.toString(),
      customer_email: userEmail,
      customer_name: userName,
      plan_type: planType,
    },
    line_items: [
      {
        price_data: {
          currency: price.currency as 'usd',
          product_data: {
            name: 'Bot License',
            description: `${price.name} - Professional Discord Bot License`,
          },
          recurring: {
            interval: price.interval as 'month' | 'year',
            interval_count: price.intervalCount,
          },
          unit_amount: price.amount,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/dashboard?payment=success`,
    cancel_url: `${origin}/pricing?payment=cancelled`,
    allow_promotion_codes: true,
  });

  return session.url;
}

export async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  
  const userId = parseInt(session.client_reference_id || '0');
  const planType = session.metadata?.plan_type || 'monthly';
  const stripeSubscriptionId = session.subscription as string;
  const stripeCustomerId = session.customer as string;

  if (!userId || !stripeSubscriptionId) {
    console.error('[Stripe] Missing required fields in checkout.session.completed event');
    return;
  }

  const licenseKey = `LIC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  const expiryDate = new Date();
  
  switch (planType) {
    case 'monthly':
      expiryDate.setMonth(expiryDate.getMonth() + 1);
      break;
    case 'quarterly':
      expiryDate.setMonth(expiryDate.getMonth() + 3);
      break;
    case 'semi_annual':
      expiryDate.setMonth(expiryDate.getMonth() + 6);
      break;
    case 'annual':
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      break;
  }

  const createdLicense = await db.createLicense({
    userId,
    licenseKey,
    planType: planType as any,
    status: 'active',
    expiryDate,
    stripeSubscriptionId,
    stripeCustomerId,
  });

  const licenseId = createdLicense.id;

  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const amount = subscription.items.data[0]?.price?.unit_amount || 0;

  await db.createTransaction({
    userId,
    licenseId,
    type: 'purchase',
    amount: (amount / 100).toString() as any,
    currency: 'USD',
    stripeTransactionId: stripeSubscriptionId,
    status: 'completed',
    description: `Purchase of ${planType} license`,
  });

  await db.createNotification({
    userId,
    type: 'payment_confirmed',
    title: 'Payment Confirmed',
    content: `Your ${planType} license has been activated. License Key: ${licenseKey}`,
    actionUrl: `/licenses/${licenseId}`,
  });

  console.log(`[Stripe] License created for user ${userId} with key ${licenseKey}`);
}

export async function handleInvoicePaid(event: Stripe.Event) {
  const invoice = event.data.object as any;
  
  const subscriptionId = invoice.subscription as string | null;
  if (!subscriptionId) {
    console.error('[Stripe] Missing subscription ID in invoice.paid event');
    return;
  }

  const licenses = await db.getAllActiveLicenses();
  const license = licenses.find(l => l.stripeSubscriptionId === subscriptionId);

  if (!license) {
    console.error(`[Stripe] License not found for subscription ${subscriptionId}`);
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);

  await db.createTransaction({
    userId: license.userId,
    licenseId: license.id,
    type: 'renewal',
    amount: (invoice.amount_paid / 100).toString() as any,
    currency: invoice.currency?.toUpperCase() || 'USD',
    stripeTransactionId: invoice.id,
    status: 'completed',
    description: `Renewal of ${license.planType} license`,
  });

  await db.createNotification({
    userId: license.userId,
    type: 'payment_confirmed',
    title: 'Subscription Renewed',
    content: `Your license has been renewed. New expiry date: ${currentPeriodEnd.toLocaleDateString()}`,
    actionUrl: `/dashboard/licenses/${license.id}`,
  });

  console.log(`[Stripe] License ${license.id} renewed`);
}

export async function handleCustomerSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  
  const subscriptionId = subscription.id;

  const licenses = await db.getAllActiveLicenses();
  const license = licenses.find(l => l.stripeSubscriptionId === subscriptionId);

  if (!license) {
    console.error(`[Stripe] License not found for subscription ${subscriptionId}`);
    return;
  }

  await db.updateLicenseStatus(license.id, 'expired');

  await db.createNotification({
    userId: license.userId,
    type: 'license_expired',
    title: 'License Expired',
    content: 'Your bot license has expired. Please renew to continue using the service.',
    actionUrl: `/pricing`,
  });

  console.log(`[Stripe] License ${license.id} marked as expired`);
}

export async function handleWebhook(req: any, res: any) {
  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      ENV.stripeWebhookSecret,
    );
  } catch (err: any) {
    console.error('[Stripe] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.id.startsWith('evt_test_')) {
    console.log('[Webhook] Test event detected, returning verification response');
    return res.json({ verified: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event);
        break;
      case 'customer.subscription.deleted':
        await handleCustomerSubscriptionDeleted(event);
        break;
      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`);
    }
    res.json({ received: true });
  } catch (err: any) {
    console.error('[Stripe] Error processing webhook:', err);
    res.status(500).json({ error: err.message });
  }
}

export { stripe };
