# Zentra Flow MVP

Zentra Flow is an import-first collections decisioning layer for small UK
service businesses and bookkeepers. It turns AR ageing reports and unpaid
invoice exports into a ranked collections plan: who to chase, what to do, why,
and what message to review.

## What is built

- Ranked collections dashboard powered by deterministic rules.
- CSV import flow with smart column mapping, validation, preview, and local demo storage.
- Re-import comparison for paid, newly overdue, still overdue, and changed invoices.
- Scenario-based action drawer for reminders, promises, remittance, disputes, statements, AP contacts, and internal escalation.
- Server-side draft generation route with Gemini/OpenAI support and template fallback.
- Server-side reply classification route with rules-first classification and optional AI fallback.
- Customer behaviour profiles and weekly cash-to-chase digest preview.
- Shared safety result helper for draft/display checks.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000/dashboard`.

Useful checks:

```bash
npm run lint
npm run build
```

## Mock data and storage

Demo data lives in:

- `src/lib/demo-data/zentra-demo-data.ts`
- `src/data/demo-invoices.ts` for older CashPilot-era demo components that still exist.

Imported invoices and demo status updates are stored in browser localStorage:

- `zentra.importedInvoices.v1`
- `zentra.importSummary.v1`
- `zentra.importDiff.v1`

There is no production database persistence yet.

## Supabase setup

Supabase support is now scaffolded but not fully wired into every product flow.

1. Copy `.env.example` to `.env.local`.
2. Add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Apply migrations in `supabase/migrations`.

The Zentra production schema starts at:

- `supabase/migrations/0002_zentra_account_system.sql`

Supabase client helpers live in:

- `src/lib/supabase/browser.ts`
- `src/lib/supabase/server.ts`

Server account helpers live in:

- `src/lib/account/server-store.ts`

When Supabase public env vars are present, the login form attempts Supabase
sign-up/sign-in before continuing to onboarding. Without those env vars, the
app keeps using the local MVP account flow.

## AI provider setup

AI calls are server-side only.

Supported env vars:

- `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` optional

If no provider key is configured, or an AI call fails, Zentra falls back to
template-generated drafts. All drafts require human review.

## Integration structure

CSV import is the current MVP path. The accounting integration placeholder
lives in:

```text
src/lib/integrations/xero.ts
```

It is a stub for a later OAuth/token/sync implementation and should not be
treated as production-ready.

## Production gaps

- Real auth and route protection.
- Rate limiting for AI API routes.
- Database persistence and audit logs.
- Encrypted provider OAuth token storage.
- File size and row limits on imports.
- DPAs/privacy review before processing real customer invoice data with AI providers.
- Removal or replacement of legacy CashPilot-era components that are no longer part of the Zentra product path.
