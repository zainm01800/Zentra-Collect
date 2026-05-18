import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { sendTransactionalEmail } from '@/lib/transactional/resend';
import { paymentFailedEmail } from '@/lib/transactional/templates';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('Stripe-Signature') as string;

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook signature verification failed: ${msg}`);
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const accountId = session.metadata?.accountId;
        const addonType = session.metadata?.addonType;

        if (!accountId) break;

        if (addonType === "email") {
          // Email add-on purchased — enable addon without touching plan_id or status
          await supabase
            .from('zentra_accounts')
            .update({
              email_addon: true,
              email_addon_subscription_id: session.subscription,
            })
            .eq('id', accountId);
        } else {
          // Base plan purchase
          const planId = session.metadata?.planId ?? 'SINGLE_BUSINESS';
          await supabase
            .from('zentra_accounts')
            .update({
              status: 'active',
              stripe_subscription_id: session.subscription,
              plan_id: planId,
            })
            .eq('id', accountId);
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const subAddonType = subscription.metadata?.addonType;

        if (subAddonType === "email") {
          // Email add-on cancelled
          const { data: account } = await supabase
            .from('zentra_accounts')
            .select('id')
            .eq('email_addon_subscription_id', subscription.id)
            .single();

          if (account && event.type === 'customer.subscription.deleted') {
            await supabase
              .from('zentra_accounts')
              .update({ email_addon: false, email_addon_subscription_id: null })
              .eq('id', account.id);
          }
        } else {
          // Base plan subscription change
          const { data: account } = await supabase
            .from('zentra_accounts')
            .select('id')
            .eq('stripe_subscription_id', subscription.id)
            .single();

          if (account) {
            // past_due = payment failed but Stripe is still retrying — keep accessible
            const status = subscription.status === 'active' ? 'active' :
                           subscription.status === 'trialing' ? 'trialing' :
                           subscription.status === 'past_due' ? 'past_due' : 'cancelled';

            await supabase
              .from('zentra_accounts')
              .update({ status })
              .eq('id', account.id);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string | undefined;
        if (!customerId) break;

        console.warn(`[webhook] Payment failed for Stripe customer ${customerId} — invoice ${invoice.id}`);

        const { data: account } = await supabase
          .from('zentra_accounts')
          .select('id, status, owner_user_id, zentra_businesses(name)')
          .eq('stripe_customer_id', customerId)
          .single();

        if (account && account.status === 'active') {
          await supabase
            .from('zentra_accounts')
            .update({ status: 'past_due' })
            .eq('id', account.id);

          // Email the account owner to update their card
          if (account.owner_user_id) {
            const { data: userData } = await supabase.auth.admin.getUserById(account.owner_user_id);
            if (userData?.user?.email) {
              const bizArr = Array.isArray(account.zentra_businesses)
                ? account.zentra_businesses
                : account.zentra_businesses ? [account.zentra_businesses] : [];
              const businessName = (bizArr[0] as { name?: string } | undefined)?.name ?? 'your business';
              const template = paymentFailedEmail({ businessName });
              sendTransactionalEmail({ to: userData.user.email, ...template }).catch(() => {});
            }
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string | undefined;
        if (!customerId) break;

        const { data: account } = await supabase
          .from('zentra_accounts')
          .select('id, status')
          .eq('stripe_customer_id', customerId)
          .single();

        // Recover from past_due if payment eventually succeeded
        if (account && account.status === 'past_due') {
          await supabase
            .from('zentra_accounts')
            .update({ status: 'active' })
            .eq('id', account.id);
        }
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook processing error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
