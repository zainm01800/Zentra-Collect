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
