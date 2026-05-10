# Zentra Collect Account System Notes

Last updated: 2026-05-08

## 1. Current Account Types

The canonical plan rules live in `src/lib/account/plans.ts`.

| Account type | Plan id | Current purpose |
| --- | --- | --- |
| Demo | `DEMO` | Sample-data experience with no expiry and limited sample draft generation. |
| 14-day Trial | `TRIAL` | No-card trial for one business using real CSV invoice exports. |
| Founding Single Business | `FOUNDING_SINGLE` | Beta/founding access for one business with a 12-month price lock. |
| Founding Bookkeeper | `FOUNDING_BOOKKEEPER` | Beta/founding access for up to 5 client ledgers with a 12-month price lock. |
| Single Business | `SINGLE_BUSINESS` | Standard paid single-business plan. |
| Bookkeeper Starter | `BOOKKEEPER_STARTER` | Standard bookkeeper plan for up to 5 client ledgers. |
| Bookkeeper Pro | `BOOKKEEPER_PRO` | Higher-capacity bookkeeper plan for up to 20 client ledgers. |

`src/lib/billing/plans.ts` still exists as a legacy compatibility adapter for older UI code. Its `getPlanConfig()` now overlays price, trial, grace, and usage limits from the central account config. New work should import from `src/lib/account/plans.ts`, `src/lib/account/access.ts`, and `src/lib/account/usage.ts`.

Supabase scaffolding now exists:

- `supabase/migrations/0002_zentra_account_system.sql`
- `src/lib/supabase/browser.ts`
- `src/lib/supabase/server.ts`
- `src/lib/account/server-store.ts`
- `src/app/auth/callback/route.ts`

## 2. Current Limits

| Plan | Price | Core limits |
| --- | ---: | --- |
| Demo | £0 | Sample data only, 3 sample AI drafts, no permanent real imports. |
| 14-day Trial | £0 | 14 days, 30-day grace period, 1 business, 100 active invoices, 2 imports total, 25 AI actions total. |
| Founding Single Business | £29/month | 1 business, 500 active invoices, 10 imports/month, 150 AI actions/month, 12-month price lock. |
| Founding Bookkeeper | £79/month | Up to 5 client ledgers, 1,500 active invoices total, 20 imports/month, 300 AI actions/month, 12-month price lock. |
| Single Business | £39/month | 1 business, 500 active invoices, 10 imports/month, 200 AI actions/month. |
| Bookkeeper Starter | £99/month | Up to 5 client ledgers, 2,000 active invoices total, 500 AI actions/month. |
| Bookkeeper Pro | £199/month | Up to 20 client ledgers, 7,500 active invoices total, 1,500 AI actions/month. |

AI actions currently include draft generation, rewrite message, reply classification, unknown import mapping, customer behaviour summary, and weekly digest narrative.

Deterministic actions do not count as AI usage: invoice ranking, days overdue calculation, sorting/filtering, import validation, re-import diffing, safety checks, and normal dashboard viewing.

## 3. What Is Mocked

- Authentication is partially scaffolded. If Supabase env vars are configured, the login form attempts Supabase sign-up/sign-in. The app shell and product data flows still rely on the local MVP account state in `localStorage` under `zentra.demoUser.v1`.
- Usage counters are local/mock only. Central usage rollups are stored in `localStorage` under `zentra.accountUsage.v1`.
- Imported invoice data is still stored in browser `localStorage`, not a database.
- Demo invoice state is separated into `zentra.demoInvoiceState.v1` so sample interactions do not overwrite real imported invoice data.
- Beta/founding access requests are stored locally under `zentra.betaRequest.v1` and `zentra.betaRequests.v1`.
- The admin beta request page is a local demo view, not protected by real admin auth.
- Billing state is internal plan state only. No Stripe checkout, customer, subscription, invoice, or webhook is live.
- Bookkeeper portfolio mode uses demo data unless a real multi-tenant backend is added.
- Email sending is not implemented. Messages are copy-only.

## 4. What Needs Supabase/Database Work

- Finish wiring real user authentication and session validation into route/page access.
- Wire server-side account records into onboarding, app shell, settings, and account selection.
- Persist businesses, bookkeeper client ledgers, customers, invoices, import batches, import mappings, import diffs, activity events, promises, disputes, and draft logs through Supabase instead of localStorage.
- Wire server-side usage event logging and monthly usage rollups into import and AI API routes.
- Backend enforcement of import, AI, invoice, and client-ledger limits. The current enforcement is client-side and suitable only for MVP demos.
- Secure storage for imported customer PII and invoice data.
- Audit history persistence for recommendation views, draft generation, copied messages, status changes, imports, reply classification, and do-not-chase decisions.
- Admin review workflow for beta/founding requests.
- Account export and deletion flows, including a real trial data retention/deletion job after the grace period.

## 5. What Needs Stripe Work

- Stripe products/prices matching the central plan config.
- Checkout or customer portal flow for upgrades.
- Subscription status sync via Stripe webhooks.
- Plan changes, cancellations, payment failure handling, and renewal-period usage reset.
- Mapping Stripe customer/subscription ids to Supabase account records.
- Billing UI should remain honest until this exists: the current copy says Stripe billing is not connected yet.

## 6. Manual Tests Before Launch

- Start demo from `/demo`; confirm it opens the dashboard with sample data and shows the demo banner.
- In demo, generate 3 drafts; confirm the 4th AI draft/reply classification is blocked with a clear upgrade prompt.
- In demo, try importing a CSV; confirm permanent import is blocked and no real import data is saved.
- In demo, mark invoices paid/promised/disputed; confirm sample state does not write to the real import storage key.
- Start a 14-day trial from onboarding; confirm trial end and grace period dates are set.
- Import two CSV files on trial; confirm the third import is blocked.
- Generate/classify 25 AI actions on trial; confirm the 26th is blocked.
- Set a trial account to expired but still in grace; confirm dashboard remains viewable and imports/AI actions are blocked.
- Set a trial account beyond grace; confirm the stronger data deletion warning appears and imports/AI actions remain blocked.
- Confirm deterministic dashboard ranking, filtering, import validation, and re-import diffing do not increase AI counters.
- Confirm Single Business cannot access real portfolio mode or add a second client ledger.
- Confirm Bookkeeper Starter can access portfolio mode and add client ledgers until the plan limit.
- Confirm pricing copy on the landing page matches `src/lib/account/plans.ts`.
- Confirm account settings usage meters match central limits.
- Confirm no UI claims payments are live.
- Confirm no feature sends email automatically.
- Confirm all draft/copy surfaces continue to say human review or approval is required.
