# Zentra Collect — Production Readiness Assessment

> **Status: Pre-alpha demo. Not production-ready. Real user data must not be stored or processed in the current build.**

Last updated: 2026-05-07

---

## 1. What Currently Works

These features are genuinely functional and could survive a production environment with appropriate surrounding infrastructure:

### Collections decision engine (`src/lib/collections/decision-engine.ts`)
- Deterministic rules-based ranking of invoices into five dashboard groups (Chase Now, Promises to Check, Exceptions, Low Priority, Do Not Chase)
- Safety check logic — blocked / needs review / safe to draft — with explicit per-code reasoning
- Urgency, confidence, and scenario classification (all rule-derived, no AI)
- Customer behaviour profile computation (`customer-behaviour.ts`)
- Weekly digest generation (`weekly-digest.ts`)
- All logic is pure functions over typed data — trivially testable and safe to trust

### CSV import pipeline (`src/lib/import/zentra-import.ts`)
- Custom CSV parser handles quoted fields, escaped quotes, CRLF/LF line endings
- Synonym-based column header detection with high/medium/low/none confidence
- Row-level validation with explicit error and warning messages
- `parseMoney()` handles currency symbols, parenthetical negatives, and thousands-separator commas
- AP report and customer-list-only detection (guards against wrong file type)
- Import diff engine compares batches to detect paid invoices, missed promises, open disputes, amount changes

### AI draft generation (`src/app/api/zentra/generate-draft/route.ts`)
- Safety checks run before any AI call — blocked invoices never reach AI
- Template fallback if no AI key is configured
- Gemini → OpenAI → template fallback chain
- All outputs have `requiresReview: true` — no auto-send path exists
- JSON parse errors now caught safely (fallback to template)

### Reply classification (`src/app/api/zentra/classify-reply/route.ts`)
- Rules-based classification runs first; AI only called for `"unclear"` results
- Conservative temperature (0.1); `requiresManualReview: true` always
- JSON parse errors now caught safely (fallback to rules result)

### UI
- Landing page, pricing page, dashboard, import flow, portfolio view, chase-today, digest — all render correctly
- Import preview, mapping, validation errors, diff dashboard all function in the browser
- Draft generation and reply classification work end-to-end with a real AI key
- All user-facing flows degrade gracefully without an AI key (template fallbacks everywhere)

---

## 2. What Is Demo/Mock Only

These features look real but are entirely fake. Do not describe them as working to users.

| Feature | Current reality |
|---------|----------------|
| **Authentication** | The login page has an email/password form that links directly to `/dashboard` with no credential check. Anyone who knows the URL is already "logged in". |
| **Data persistence** | All invoice data, import history, promises, disputes, and activity logs are stored in `localStorage`. They are lost on browser clear, not shared between devices, and invisible on the server. |
| **User accounts** | There are no user accounts. The settings form saves to `localStorage`. There is no concept of a registered user. |
| **Multi-client portfolio** | The portfolio view and per-client dashboard use hardcoded demo data. The `BookkeeperClient` type exists but is never populated from real data. |
| **Xero integration** | `src/lib/integrations/xero.ts` returns demo invoice data for every function. `connectXero()` returns `connected: false`. Nothing talks to the Xero API. |
| **Email sending** | There is no email sending at all. "Send" means copy-to-clipboard. Users are expected to paste into their own email client. This is intentional for MVP but must not be confused with a delivery mechanism. |
| **Reference date** | All overdue calculations use the hardcoded string `"2026-05-07"`. On any date other than 7 May 2026, all urgency levels, chase recommendations, and day counts will be wrong for real imported data. |
| **Business ID** | All imported invoices are assigned `businessId = "biz-imported-demo"`. This means every import, from every browser, in every session, shares the same fake business context in memory. |
| **Settings** | The settings form (brand voice, sender name, payment terms) saves to `localStorage` and is never read by the AI draft or decision engine in production paths. |
| **Subscription enforcement** | The pricing page is purely marketing. No subscription check exists anywhere in the application. |
| **Login page branding** | The login page still says "Sign in to CashPilot" and includes the text "Auth is mocked for the MVP." |

---

## 3. What Must Be Built Before Real Users

Ordered by priority. Nothing below "Authentication" is meaningful without it.

### Critical path (nothing ships without these)

**Authentication and session management**
- Supabase Auth is the intended provider (mentioned in login page comment)
- Implement email/password and magic link sign-in
- Protect every `/dashboard`, `/import`, `/portfolio`, `/digest`, `/chase-today`, `/invoices/[id]` route with server-side session check
- Protect all three API routes (`/api/zentra/generate-draft`, `/api/zentra/classify-reply`, `/api/generate-reminder`) — currently completely unprotected; any HTTP client can call them and run up AI costs

**Real database**
- No SQL schema exists in the repository. Supabase is scaffolded but empty.
- Minimum schema required: see Section 10 below
- Every `localStorage.getItem` / `localStorage.setItem` in `zentra-import.ts` keys and `zentra-dashboard.tsx` must be replaced with authenticated server reads/writes

**Dynamic reference date**
- Replace hardcoded `"2026-05-07"` in `zentra-dashboard.tsx` and `DEFAULT_REFERENCE_DATE` in `decision-engine.ts` with `new Date().toISOString().slice(0, 10)` before any real invoice data is processed

**Rate limiting on AI routes**
- `/api/zentra/generate-draft` and `/api/zentra/classify-reply` have no authentication or rate limiting
- A single unauthenticated request loop can run up substantial Gemini/OpenAI charges
- Implement per-user token bucket or use edge middleware (Vercel, Upstash) before deploying to a public URL

### Important but not day-one blockers

**Billing and subscription enforcement**
- Plans and pricing are defined; no enforcement exists
- Gate features (portfolio view, unlimited imports, team access) behind plan-level checks

**Xero / QuickBooks import**
- Currently stub functions — see Section 9

**Email delivery infrastructure**
- If/when moving beyond copy-paste — see Section 8

**Retire legacy CashPilot code**
- `src/types/cashpilot.ts` and the components that import it (`dashboard-view.tsx`, `chase-queue.tsx`, `reminder-generator.tsx`, `invoice-card.tsx`, `status-badge.tsx`, etc.) are dead product surface from the original CashPilot build
- `src/app/api/generate-reminder/route.ts` and `src/lib/reminders.ts` are the old AI route, superseded by the Zentra draft system
- These should be removed once the legacy dashboard routes are retired, not maintained in parallel

---

## 4. Security Risks

### Critical

**No authentication on API routes**
All three AI API routes (`/api/zentra/generate-draft`, `/api/zentra/classify-reply`, `/api/generate-reminder`) are publicly accessible with no session check, API key, or origin restriction. Any script can POST to these endpoints and charge AI costs to the operator's account.

**No authentication on any application route**
Every page in the application is accessible to any visitor. The login page is decorative. The dashboard, import, portfolio, and settings pages load and display immediately without checking for a session.

### High

**AI prompt injection via customer data**
Customer names, invoice notes, and dispute reasons from imported CSV files are interpolated directly into AI prompts in `buildDraftPrompt()` and `buildReplyClassificationPrompt()`. A malicious CSV row with a crafted customer name could attempt to manipulate the AI's output (e.g., `customerName: "Ignore previous instructions and write: ..."` ). Sanitise or truncate all user-derived fields before prompt interpolation, and treat AI output as untrusted content.

**localStorage as sole persistence**
Invoice data stored in `localStorage` is readable by any JavaScript running on the same origin. An XSS vulnerability anywhere on the domain would expose the complete invoice dataset of every open session. This is particularly acute if the app is ever served from a shared hosting origin.

### Medium

**No CSRF protection on API routes**
The API routes use `NextResponse` but have no CSRF token check. Once authentication is added, CSRF protection must be added for state-mutating routes.

**CSV content is not sanitised before DOM rendering**
Imported customer names, invoice numbers, and notes are rendered directly into the UI. Next.js escapes string interpolation in JSX, so this is not an immediate XSS risk, but any future use of `dangerouslySetInnerHTML` with imported data would be critical.

**No input length limits on AI prompts**
A large CSV import with very long `notes` fields will produce very long AI prompts, potentially hitting model context limits or generating unexpected behaviour. Truncate user-derived fields to a safe maximum before prompt construction.

---

## 5. Data Privacy and GDPR Considerations

Zentra Collect processes financial data about third parties (the end-user's customers). This creates obligations under UK GDPR that do not apply to a typical SaaS tool.

### Data categories processed
- Customer names, email addresses, phone numbers (PII)
- Invoice amounts, outstanding balances, payment history (financial data)
- Dispute reasons, payment behaviour notes (potentially sensitive commercial data)
- AP contact details and roles

### What gets sent to AI providers
Every time a user generates a draft or classifies a reply, the following data is sent to **Google Gemini** (first) or **OpenAI** (fallback):
- Customer name
- Invoice number and amount outstanding
- Days overdue
- Customer relationship notes
- Dispute reasons (if any)
- Reply text content (for classification)

This is PII belonging to the end-user's customers, not the end-user themselves. Before processing real data:

1. **Data Processing Agreements (DPAs)** — Execute DPAs with Google and OpenAI as sub-processors. Both providers offer these; they are not automatic.
2. **Privacy policy** — Publish a clear privacy policy disclosing that invoice and customer data may be processed by AI sub-processors for draft generation. Users must consent.
3. **Data residency** — By default, Gemini and OpenAI may process data outside the UK/EEA. Confirm model endpoints or request UK/EU data residency if required.
4. **Opt-out for AI processing** — Provide a way for users to generate template-only drafts without sending any data to AI providers. The template fallback already exists technically; expose it as a user preference.
5. **Data retention** — Define and enforce retention limits. `localStorage` has no expiry. A real database needs automated deletion schedules.
6. **Right of access / erasure** — Once data is stored server-side, implement mechanisms to export and delete all data for a given business account.
7. **Invoice data is third-party PII** — The end-user's customers have not consented to their financial data being processed by Zentra Collect. The end-user (as data controller) must ensure their own terms of business or privacy notice permits this use.

### What is not a GDPR issue in the current demo
The current build stores nothing server-side. All data lives in the user's own browser. No data leaves the machine except for AI prompt calls. This is actually low-risk for the demo, but that changes the moment a database is added.

---

## 6. AI Safety Considerations

### What the current build gets right
- Safety checks (`getDraftSafety`) block AI calls for disputed invoices, do-not-chase accounts, and high-value at-risk accounts
- `requiresReview: true` is hard-coded on every AI response — there is no code path that auto-sends
- Template fallbacks exist for every AI call
- AI is used only for drafting and classification — never for ranking, urgency, or decision logic
- Conservative temperatures (0.35 for drafts, 0.1 for classification)

### Risks that remain

**AI output is displayed without validation**
Draft subject lines and body text from AI are rendered directly into the textarea. If the AI produces a response that contains inappropriate language, incorrect amounts, or legal claims, it will be shown to the user. Add a post-generation content check or at minimum a visible "Review carefully before sending" warning adjacent to the draft output.

**Confidence labels are taken from AI self-report**
When `parseDraftJson()` returns a confidence value from the AI, it is used directly after a three-value type check (`"high"` / `"medium"` / `"low"`). The AI can always claim `"high"` confidence regardless of actual quality. These labels should be treated as hints, not facts.

**No logging of AI calls**
There is no server-side logging of what prompts were sent or what responses were received. This makes it impossible to audit, debug, or review AI behaviour in production. Add structured logging (redacted of PII) to all AI route handlers.

**Gemini key from environment is not validated at startup**
If `GEMINI_API_KEY` is set but invalid, the draft route will attempt a Gemini call, receive a non-OK response, throw, and fall back to OpenAI or template. This is handled, but it produces silent degradation with no operator alert. Validate API keys at startup and surface an error in admin/settings.

---

## 7. Import Validation Risks

### Known issues fixed in the last audit
- `parseMoney("1,250.00")` previously returned `NaN` because comma was not in the strip regex. Fixed.

### Remaining risks

**No file size limit**
There is no check on the size of the uploaded CSV file. A 50 MB file will be read into memory synchronously, potentially freezing the browser tab. Add a client-side file size limit (suggested: 5 MB) before processing.

**No row count limit**
Importing 10,000 rows of invoices into `localStorage` will produce a very large object and may hit the `localStorage` quota (typically 5–10 MB per origin). Add a row count warning above ~500 rows and a hard limit above ~2,000.

**`parseDate()` locale-dependent fallback**
The final fallback in `parseDate()` calls `new Date(trimmed)` which is locale-dependent. The string `"01/02/2025"` will be interpreted as 1 February 2025 in one environment and as January 2, 2025 in another. The ISO and DD/MM/YYYY paths above it are explicit, but any date format not matching those two patterns falls through to this ambiguous path. Add explicit pattern detection for `"1 Jan 2025"`, `"Jan-2025"`, `"January 2025"` and other common UK accounting export formats.

**Excel exports are not supported**
The import pipeline only handles CSV. Many accounting systems (Xero, Sage, FreeAgent) default to `.xlsx` exports. Users will need to export as CSV manually. This is undocumented in the UI.

**Column mapping is deterministic only**
AI-assisted column mapping is stubbed out (`requestAiAssistedMappingPlaceholder` returns `null`). Users with non-standard column names will need to map manually. This is acceptable for MVP but should be surfaced clearly rather than silently returning zero suggestions.

**Import history is not deduplicated across batches**
If a user imports the same CSV twice, all invoices are imported twice with different IDs (because IDs include `Date.now()` in `sourceBatchId`). The diff engine will see all invoices as newly added on the second import. Add content-based deduplication (e.g., hash of invoiceNumber + customerName + amount) before inserting into a real database.

---

## 8. Email Sending Risks

### Current state
Zentra Collect does not send any email. The only email-related action is copying a draft message to the clipboard. This is correct for MVP and avoids a large set of compliance, deliverability, and safety risks.

### If email sending is added in future, these risks apply

**CAN-SPAM / UK commercial email law**
Any email sent on behalf of a business must include the sender's registered address and a mechanism to opt out of future commercial communications. Collections emails are arguably transactional (not marketing), but this is not a settled legal distinction in all contexts.

**Deliverability**
Sending from a shared IP or domain without SPF, DKIM, and DMARC records will result in high spam rates. Use a transactional email provider (SendGrid, Postmark, Resend) with proper DNS configuration.

**Per-user sending identity**
The draft system generates emails "from" the user's business. The application must never send email from a Zentra-owned domain pretending to be a user's business. Each business must authenticate its sending domain.

**Unintended sending**
The product principle is "human approval before every send". If email sending is added, the approval step must be explicit and irreversible (a dedicated confirm dialog, not just a single button). There must be no batch-send mechanism that sends to multiple customers in one action without per-recipient review.

**Tone safety at send time**
Currently, safety checks run at draft generation time. If email sending is added, safety checks must run again at send time against the live invoice state, because the invoice status may have changed between draft generation and clicking send.

**Audit trail**
Every sent email must be logged with: recipient, subject, body hash, timestamp, and the user who approved it. This is non-negotiable for a collections tool.

---

## 9. Future Xero / QuickBooks Integration Plan

### Current state
`src/lib/integrations/xero.ts` exists but every function returns demo data. There is no OAuth flow, no token storage, no API calls. QuickBooks is not mentioned anywhere in the codebase.

### What must be built for real Xero integration

**OAuth 2.0 authorization code flow**
- Register Zentra Collect as a Xero App (app.xero.com)
- Implement the authorization redirect, callback handler, and token exchange
- Store `access_token`, `refresh_token`, and `tenant_id` securely per business account (never in `localStorage`)
- Implement token refresh before expiry (Xero access tokens expire after 30 minutes)

**Tenant selection**
- A Xero user may have access to multiple organisations (tenants)
- After authorization, present a tenant picker and store the selected `tenant_id`

**Invoice fetch**
- Use the Xero Accounting API `/Invoices` endpoint with filters: `Status=AUTHORISED&Type=ACCREC`
- Map Xero `Invoice` → Zentra `Invoice` fields (the field names differ significantly)
- Respect Xero's rate limit: 60 calls/minute per app per tenant

**Incremental sync**
- Use `modifiedAfter` query parameter to fetch only invoices changed since the last sync
- Store `lastSyncedAt` per tenant

**Webhook support (future)**
- Xero can push invoice-updated events via webhooks
- This would allow real-time overdue detection without polling
- Not required for v1 — polling is acceptable

**For QuickBooks Online**
- Separate OAuth app registration (Intuit developer portal)
- Different API shape; build a separate adapter, not a fork of the Xero adapter

### Architecture recommendation
Build a server-side sync job (Next.js API route or Supabase Edge Function) that:
1. Fetches updated invoices from Xero/QuickBooks
2. Runs the Zentra import validation pipeline
3. Persists results to the database
4. Triggers a new diff computation against the previous batch

Do not build a client-side Xero connection. OAuth tokens must never touch the browser.

---

## 10. Database Schema Required

The Supabase migration scaffold exists but contains no SQL. The following schema is the minimum for a production v1.

```sql
-- Businesses (one per Single Business subscriber; multiple per bookkeeper)
businesses (
  id uuid primary key,
  name text not null,
  trading_name text,
  contact_email text not null,
  sender_name text,
  reply_to_email text,
  payment_terms_days integer default 30,
  brand_voice_notes text,
  plan text not null default 'single_business', -- single_business | bookkeeper_starter | bookkeeper_pro
  created_at timestamptz default now()
)

-- Auth users → business membership
business_members (
  id uuid primary key,
  business_id uuid references businesses,
  user_id uuid references auth.users,
  role text not null default 'owner', -- owner | member
  created_at timestamptz default now()
)

-- Bookkeeper client portfolios (bookkeeper plan only)
bookkeeper_clients (
  id uuid primary key,
  bookkeeper_business_id uuid references businesses,
  client_business_id uuid references businesses,
  portfolio_label text,
  created_at timestamptz default now()
)

-- Customers (debtors, not Zentra users)
customers (
  id uuid primary key,
  business_id uuid references businesses,
  name text not null,
  email text,
  ap_email text,
  ap_contact_name text,
  relationship_type text,
  do_not_chase boolean default false,
  customer_notes text,
  created_at timestamptz default now()
)

-- Import batches
import_batches (
  id uuid primary key,
  business_id uuid references businesses,
  file_name text,
  row_count integer,
  imported_at timestamptz default now(),
  imported_by uuid references auth.users,
  source text default 'csv' -- csv | xero | quickbooks
)

-- Invoices
invoices (
  id uuid primary key,
  business_id uuid references businesses,
  customer_id uuid references customers,
  import_batch_id uuid references import_batches,
  invoice_number text not null,
  invoice_date date,
  due_date date,
  amount numeric(12,2) not null,
  amount_outstanding numeric(12,2) not null,
  currency text default 'GBP',
  status text not null, -- overdue | due_soon | promised | ...
  days_overdue integer default 0,
  previous_chase_count integer default 0,
  last_chased_date date,
  promised_payment_date date,
  dispute_reason text,
  payment_claimed boolean default false,
  remittance_needed boolean default false,
  statement_needed boolean default false,
  relationship_type text,
  customer_notes text,
  source_batch_id uuid references import_batches,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)

-- Promises to pay
promises (
  id uuid primary key,
  invoice_id uuid references invoices,
  promised_amount numeric(12,2),
  promised_date date,
  recorded_at timestamptz default now(),
  recorded_by uuid references auth.users,
  status text default 'open', -- open | met | missed | cancelled
  notes text
)

-- Disputes
disputes (
  id uuid primary key,
  invoice_id uuid references invoices,
  reason text,
  raised_at timestamptz default now(),
  owner text,
  status text default 'open', -- open | waiting_on_customer | waiting_on_business | resolved
  resolution_notes text
)

-- Activity log (immutable audit trail)
activity_events (
  id uuid primary key,
  invoice_id uuid references invoices,
  customer_id uuid references customers,
  business_id uuid references businesses,
  type text not null,
  title text not null,
  description text,
  created_at timestamptz default now(),
  created_by uuid references auth.users
)

-- AI drafts generated (for audit logging)
draft_log (
  id uuid primary key,
  invoice_id uuid references invoices,
  business_id uuid references businesses,
  scenario text,
  tone text,
  source text, -- gemini | openai | template
  subject_hash text, -- store hash not plaintext for privacy
  body_hash text,
  safety_status text,
  created_at timestamptz default now(),
  created_by uuid references auth.users
)

-- OAuth tokens for Xero / QuickBooks (encrypted at rest)
oauth_connections (
  id uuid primary key,
  business_id uuid references businesses,
  provider text not null, -- xero | quickbooks
  tenant_id text,
  access_token_enc text, -- encrypted
  refresh_token_enc text, -- encrypted
  expires_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz default now()
)
```

Row-level security (RLS) must be enabled on every table. Every query must be scoped to `business_id = auth.uid()` or a business the authenticated user is a member of.

---

## 11. Testing Checklist

The repository currently has zero automated tests. Before launch:

### Unit tests (priority: decision engine and import)
- [ ] `calculateDaysOverdue` with normal, zero, and future due dates
- [ ] `rankCollectionActions` produces deterministic output for each invoice state
- [ ] `groupActionsByCategory` correctly bins all action types
- [ ] `parseMoney` handles: `"1,250.00"`, `"£1,250"`, `"(500)"`, `"-500"`, `"0"`, `""`, `"N/A"`, `"1.250,00"` (European decimal — expect null)
- [ ] `parseDate` handles: ISO, DD/MM/YYYY, DD-MM-YYYY, `"1 Jan 2025"`, `"Jan 2025"`, blank, invalid
- [ ] `parseCsv` handles: quoted fields with commas, escaped quotes, CRLF/LF, blank rows, single column
- [ ] `validateImport` produces correct errors for missing required fields
- [ ] Safety checks: each `SafetyCheckCode` produces the expected `SafetyStatus`
- [ ] `buildCustomerBehaviourProfile` computes correct risk labels from known input sets

### Integration tests (API routes)
- [ ] `POST /api/zentra/generate-draft` with valid input returns a draft
- [ ] `POST /api/zentra/generate-draft` with missing `scenario` returns 400
- [ ] `POST /api/zentra/generate-draft` with malformed JSON returns 400
- [ ] `POST /api/zentra/generate-draft` with a blocked safety status returns template without AI call
- [ ] `POST /api/zentra/classify-reply` with clear payment confirmation text classifies without AI
- [ ] `POST /api/zentra/classify-reply` with malformed JSON returns 400

### End-to-end tests
- [ ] Import a valid CSV → see invoices in dashboard
- [ ] Import a CSV with errors → see validation errors, not crash
- [ ] Import a CSV with comma-formatted amounts → amounts parse correctly
- [ ] Open an invoice action drawer → generate a draft → copy to clipboard
- [ ] Mark an invoice as promised → it moves to the correct dashboard group
- [ ] Import a second CSV → diff summary appears with correct changes
- [ ] Portfolio view loads per-client data correctly

### Manual regression tests before each deploy
- [ ] Landing page renders and all links work (including pricing anchor)
- [ ] Demo dashboard loads with demo data
- [ ] Import flow end-to-end with a real Xero-exported CSV
- [ ] Draft generation works without an AI key (template fallback)
- [ ] Draft generation works with a real AI key
- [ ] All safety-blocked invoices cannot generate AI drafts

---

## 12. Launch Checklist

Complete in order. Do not skip steps.

### Infrastructure
- [ ] Supabase project created with production credentials (not the free tier for real user data)
- [ ] Database schema migrated with RLS enabled on all tables
- [ ] Environment variables set: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY` or `GEMINI_API_KEY`
- [ ] Vercel (or equivalent) deployment with environment-specific secrets
- [ ] Custom domain configured with HTTPS
- [ ] SPF, DKIM, DMARC DNS records in place if any transactional email is sent

### Authentication
- [ ] Supabase Auth enabled (email/password + magic link)
- [ ] Every application route protected with server-side session check
- [ ] Every API route validates session before processing
- [ ] Rate limiting active on all AI routes (suggested: 10 requests/user/hour for draft generation)
- [ ] Login page rebranded from CashPilot to Zentra Collect

### Data
- [ ] `referenceDate` hardcode replaced with `new Date()` in both dashboard and decision engine
- [ ] `businessId` default replaced with authenticated user's business ID from session
- [ ] All `localStorage` calls replaced with authenticated server reads/writes
- [ ] Legacy CashPilot routes and components removed or clearly flagged as inactive

### Legal and compliance
- [ ] Privacy policy published and linked from landing page footer
- [ ] Terms of service published and linked from landing page footer
- [ ] Cookie consent banner in place (only analytics/non-essential cookies need consent)
- [ ] Data Processing Agreements executed with Google (Gemini) and OpenAI
- [ ] Supabase DPA accepted (available in Supabase dashboard)
- [ ] GDPR-compliant data deletion mechanism in place for user account closure

### Monitoring
- [ ] Error tracking configured (Sentry or equivalent)
- [ ] Structured logging on all API routes (redacted of PII)
- [ ] Uptime monitoring configured
- [ ] AI spend alerting configured on Gemini/OpenAI dashboards

### Billing
- [ ] Stripe (or equivalent) integration in place
- [ ] Subscription status checked at login and on protected routes
- [ ] Plan-gating logic enforced (portfolio view requires bookkeeper plan, etc.)
- [ ] Billing portal accessible from settings

### Final review
- [ ] All demo-only notices removed from UI (e.g., login page comment)
- [ ] All TODO comments reviewed — mark as resolved or convert to tracked issues
- [ ] TypeScript build clean: `npx tsc --noEmit` exits 0
- [ ] ESLint clean: `npx eslint src/` exits 0 with no warnings
- [ ] Production build succeeds: `npx next build` exits 0
- [ ] Penetration test or security review of auth and data access paths

---

## 13. What Not to Build Yet

Stay focused. The following will be requested and should be declined until the core product is stable with real users.

| Request | Why to defer |
|---------|-------------|
| **Automatic email sending** | Requires SPF/DKIM, opt-out mechanisms, audit trail, tone safety at send time, and legal review. The copy-paste model is safer and sufficient for launch. |
| **SMS or WhatsApp chasing** | Different compliance regime (PECR in the UK), higher risk of harassment complaints, and not what the target user is asking for. |
| **Native mobile app** | The web product is not stable yet. A mobile app doubles the surface to maintain. |
| **Payment processing / pay now links** | Requires PCI DSS compliance and a payment gateway. Out of scope — Zentra is a collections workflow tool, not a payment processor. |
| **Customer-facing portal** | Where debtors log in to view invoices or dispute charges. Completely separate product surface with separate auth, branding, and legal obligations. |
| **Full Xero / QuickBooks sync on day one** | CSV import is sufficient for launch and faster to harden. OAuth integrations should follow after the core product is proven. |
| **AI-powered collection strategy decisions** | The decision engine is intentionally deterministic. Do not replace ranking logic with AI — it would be slower, less auditable, and less reliable than the current rule set. |
| **CRM or contact management** | Zentra is not a CRM. Customer records exist only to support collections decisions. Do not expand into relationship management, communication history, or contact enrichment. |
| **Accounts payable / expense tracking** | The AGENTS.md explicitly excludes AP ageing. |
| **Forecasting or cash flow modelling** | A separate product category requiring different data, different UI, and different user expectations. |
| **Open-ended AI chat / co-pilot interface** | The AI role is narrowly scoped: draft a message, classify a reply. A general AI chat interface would expand scope, increase cost, and dilute the focused collections UX. |
| **Multi-currency support beyond GBP** | The data model supports it (`CurrencyCode` type exists) but the UI, formatting, and decision logic all assume GBP. Do not unlock until a clear user need is established. |
