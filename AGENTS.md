# AGENTS.md

Durable project instructions for agents working on this repository.

## Project Identity

This product is **Zentra Collect**.

Zentra Collect is a collections decisioning layer for small UK service businesses and bookkeepers. It turns overdue invoice exports into a ranked collections plan: who to chase, what to do, what to ignore, what changed, and what message to send.

Primary positioning:

- "Upload overdue invoices. Get a ranked chase plan in minutes."
- "Know who to chase, what to do, and why."

Core product principle:

**Action + reason + message.**

Every recommendation should show:

1. Recommended action
2. Plain-English reason
3. Draft follow-up message
4. Confidence / safety status

## Target Users

- UK bookkeepers managing multiple small-business clients
- Small UK agencies and service businesses
- Consultants and B2B freelancers with unpaid invoices

## Product Boundaries

Collections decisioning is the core. A small set of light-touch books
features (Bank feed import, Expenses, Tax estimate, Aged debt) is in
scope to serve smaller clients and bookkeepers handling small books
who would otherwise need a separate tool. Keep these features minimal,
read-only-ish, and never the headline — they support the chase
workflow, they don't replace a full accounting product.

Do not turn this into:

- An autonomous collections engine (human approval stays required)
- A legal debt recovery system
- A payment processing product
- A customer portal
- SMS or call automation
- A full general-ledger / double-entry accounting product (Sage / Xero replacement)
- A payroll, CRM, or project-management tool
- A native mobile app
- An open-ended AI chatbot

Stay focused on turning invoice data into a ranked, explainable chase
plan, with light books support around it for small-client workflows.

## Safety Rules

- Human approval is required before every outbound message.
- No automatic sending in the MVP.
- Do not provide legal advice.
- Do not provide accounting or tax advice.
- Do not use aggressive debt collection language.
- Avoid phrases like "legal action", "enforcement", and "debt collector" unless the user explicitly writes their own wording.
- Add disclaimers where relevant.
- Always make clear that the user is responsible for reviewing messages before sending.

## Architecture Principles

- Rules first, AI second.
- Use deterministic logic for ranking, overdue calculations, statuses, safety checks, and confidence labels.
- Use AI only for drafting, reply classification, summarising, and uncertain column mapping.
- Do not call AI unnecessarily.
- Keep AI API calls server-side only.
- Never expose secret keys to the frontend.
- Keep code modular and easy to swap from demo data to persisted/imported data.
- Add loading, error, and empty states for user-facing flows.
- Desktop-first, mobile responsive.

## Design Direction

Match the Zentra brand style shown in the product references:

- Warm off-white background
- Black / charcoal primary text
- Muted grey secondary text
- Rounded black pill CTAs
- Large clean typography
- Soft cards
- Subtle borders
- Lots of whitespace
- Calm premium minimal design
- No flashy fintech gradients
- No cluttered corporate dashboard look

UI should feel like a focused premium SaaS workflow, not a generic accounting dashboard and not an AI toy.

## Current Repository Notes

- Stack: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, OpenAI server route, Supabase migration scaffold.
- Existing implementation was originally named CashPilot and should be renamed/repositioned to Zentra Collect in future product work.
- Demo invoice data currently lives under `src/data`.
- Ranking, urgency, reminder, and chase-plan logic currently lives under `src/lib`.
- User-facing product surfaces live under `src/app` and `src/components`.

## Next.js Version Note

This repository uses a modern Next.js version with breaking changes compared with older App Router examples. Before changing framework-level patterns, check the local project conventions and current Next.js docs or installed references. Heed deprecation notices.

## Implementation Guidance

- Prefer small, product-aligned changes over broad rewrites.
- Keep recommendation UI explicit: action, reason, message, confidence / safety.
- Make empty states helpful and specific to invoice import or collections workflow.
- Avoid adding unrelated modules such as payments, CRM, payroll, or project management. Light books features (bank feed import, expenses, tax estimate) are in scope but should stay small and support collections — they are not the headline.
- Preserve server-side boundaries for secrets and AI calls.
- Run lint/build after meaningful implementation work when possible.
