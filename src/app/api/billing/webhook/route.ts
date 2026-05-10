import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('Stripe-Signature') as string;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const accountId = session.subscription_data?.metadata?.accountId || session.metadata?.accountId;
        
        if (accountId) {
          await supabase
            .from('zentra_accounts')
            .update({
              status: 'active',
              stripe_subscription_id: session.subscription,
              plan_id: session.metadata?.planId || 'FOUNDING_SINGLE' // Default to single if not specified
            })
            .eq('id', accountId);
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const { data: account } = await supabase
          .from('zentra_accounts')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (account) {
          const status = subscription.status === 'active' ? 'active' : 
                         subscription.status === 'trialing' ? 'trialing' : 
                         subscription.status === 'past_due' ? 'expired' : 'cancelled';
          
          await supabase
            .from('zentra_accounts')
            .update({ status })
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
