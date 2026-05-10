import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { priceId, planId } = await request.json();
    if (!priceId) {
      return NextResponse.json({ error: 'Price ID is required' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the account associated with the user
    const { data: memberData } = await supabase
      .from('zentra_account_members')
      .select('account_id, zentra_accounts(stripe_customer_id)')
      .eq('user_id', user.id)
      .single();

    if (!memberData) {
      return NextResponse.json({ error: 'No account found' }, { status: 404 });
    }

    const accountId = memberData.account_id;
    const account = memberData.zentra_accounts as any;
    let stripeCustomerId = account?.stripe_customer_id;

    // Create a Stripe customer if they don't have one
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          accountId: accountId,
          supabaseUserId: user.id,
        },
      });
      stripeCustomerId = customer.id;

      // Update the account with the new Stripe customer ID
      await supabase
        .from('zentra_accounts')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', accountId);
    }

    // Create the checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${request.headers.get('origin')}/dashboard?checkout_success=true`,
      cancel_url: `${request.headers.get('origin')}/pricing?checkout_cancelled=true`,
      subscription_data: {
        metadata: {
          accountId: accountId,
          planId: planId?.toUpperCase().replace(/_SINGLE_BUSINESS$/, '_SINGLE') || 'SINGLE_BUSINESS',
        },
      },
      metadata: {
        accountId: accountId,
        planId: planId?.toUpperCase().replace(/_SINGLE_BUSINESS$/, '_SINGLE') || 'SINGLE_BUSINESS',
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
