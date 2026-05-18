const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zentracollect.co.uk";

const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #fbf8f1;
  color: #1d1813;
  margin: 0;
  padding: 0;
`;

function shell(body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${BASE_STYLE}">
  <div style="max-width:560px;margin:40px auto;padding:0 16px">
    <p style="font-size:13px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#8d8472;margin-bottom:24px">Zentra Collect</p>
    ${body}
    <hr style="border:none;border-top:1px solid #e8e0d0;margin:32px 0">
    <p style="font-size:12px;color:#8d8472;line-height:1.6">
      Zentra Collect · United Kingdom<br>
      <a href="${SITE}/settings" style="color:#8d8472">Manage notifications</a>
    </p>
  </div>
</body></html>`;
}

function cta(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#1d1813;color:#fbf8f1;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:100px;margin-top:8px">${label}</a>`;
}

// ── Welcome ───────────────────────────────────────────────────────────────────

export function welcomeEmail(opts: { businessName: string; trialEndsAt: Date }) {
  const days = Math.ceil((opts.trialEndsAt.getTime() - Date.now()) / 86_400_000);

  const html = shell(`
    <h1 style="font-size:26px;font-weight:700;margin:0 0 8px">Welcome to Zentra Collect</h1>
    <p style="font-size:15px;line-height:1.7;color:#4a4236;margin:0 0 20px">
      Your 14-day trial is live for <strong>${opts.businessName}</strong>. You have ${days} days to explore — no card required.
    </p>
    <p style="font-size:15px;line-height:1.7;color:#4a4236;margin:0 0 24px">
      The quickest way to see value: import your overdue AR export and get a ranked chase plan in under two minutes.
    </p>
    ${cta("Import your invoices →", `${SITE}/import`)}
    <p style="font-size:13px;color:#8d8472;margin-top:20px">
      Not ready? <a href="${SITE}/demo" style="color:#1d1813">Explore the demo</a> with sample data first.
    </p>
  `);

  const text = `Welcome to Zentra Collect

Your 14-day trial is live for ${opts.businessName}. You have ${days} days to explore — no card required.

Import your invoices to get a ranked chase plan: ${SITE}/import

Not ready? Explore the demo with sample data: ${SITE}/demo

— The Zentra Collect team`;

  return {
    subject: "Welcome to Zentra Collect — your trial has started",
    html,
    text,
  };
}

// ── Payment failed ────────────────────────────────────────────────────────────

export function paymentFailedEmail(opts: { businessName: string }) {
  const html = shell(`
    <h1 style="font-size:26px;font-weight:700;margin:0 0 8px">Payment failed</h1>
    <p style="font-size:15px;line-height:1.7;color:#4a4236;margin:0 0 20px">
      We couldn't collect the subscription payment for <strong>${opts.businessName}</strong>. Your account is still accessible while we retry, but please update your card to avoid any interruption.
    </p>
    ${cta("Update payment method →", `${SITE}/settings?tab=billing`)}
    <p style="font-size:13px;color:#8d8472;margin-top:20px">
      If you've already updated your card, no action is needed — Stripe will retry automatically within a few days.
    </p>
  `);

  const text = `Payment failed for ${opts.businessName}

We couldn't collect your subscription payment. Your account is still accessible while we retry.

Update your payment method: ${SITE}/settings?tab=billing

If you've already updated your card, Stripe will retry automatically.

— The Zentra Collect team`;

  return {
    subject: "Action needed: your Zentra Collect payment failed",
    html,
    text,
  };
}

// ── Trial ending ──────────────────────────────────────────────────────────────

export function trialEndingEmail(opts: { businessName: string; trialEndsAt: Date; daysLeft: number }) {
  const html = shell(`
    <h1 style="font-size:26px;font-weight:700;margin:0 0 8px">Your trial ends in ${opts.daysLeft} day${opts.daysLeft === 1 ? "" : "s"}</h1>
    <p style="font-size:15px;line-height:1.7;color:#4a4236;margin:0 0 20px">
      The Zentra Collect trial for <strong>${opts.businessName}</strong> expires on <strong>${opts.trialEndsAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</strong>.
    </p>
    <p style="font-size:15px;line-height:1.7;color:#4a4236;margin:0 0 24px">
      After that, access to your chase plan, AI drafts, and imported invoices will be paused. Upgrade now to keep everything running without interruption.
    </p>
    ${cta("See plans →", `${SITE}/pricing`)}
    <p style="font-size:13px;color:#8d8472;margin-top:20px">
      Plans start at £29/mo. No setup fee. Cancel any time.
    </p>
  `);

  const text = `Your Zentra Collect trial ends in ${opts.daysLeft} day${opts.daysLeft === 1 ? "" : "s"}

The trial for ${opts.businessName} expires on ${opts.trialEndsAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.

After that, access to your chase plan, AI drafts, and imported invoices will be paused.

See plans: ${SITE}/pricing

Plans start at £29/mo. No setup fee. Cancel any time.

— The Zentra Collect team`;

  return {
    subject: `Your Zentra Collect trial ends in ${opts.daysLeft} day${opts.daysLeft === 1 ? "" : "s"}`,
    html,
    text,
  };
}
