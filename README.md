# GTM Intelligence Engine

A B2B GTM intelligence platform built for a maritime technology vendor: detect
account signals, score opportunities deterministically, generate AI-assisted
account research and GTM recommendations, and queue human-approved activation —
all with evidence tracked back to a source.

> Built against a real company's GTM. For this public release the vendor is
> fictionalised as **Meridian Marine Systems (MMS)** and all seed/demo data
> (accounts, contacts, signals) is invented.

> **Status: Phase 6.** Repository structure, database schema, seed data,
> and a base UI shell (Phase 1), full account/contact management and CSV
> import (Phase 2), a deterministic GTM scoring engine (Phase 3), an AI
> research + GTM intelligence layer (Phase 4), external signal/research
> ingestion (Phase 4.5 — SOURCE → FACT → SIGNAL → SCORE → INTELLIGENCE), a
> production research provider with caching/freshness, budget limits, and
> source-quality classification (Phase 4.75), human-approved GTM activation
> (Phase 5 — AI-drafted LinkedIn/email/sales-brief/content-recommendation
> content that a human must review and explicitly approve before it's ever
> marked sent), and outcomes/attribution/GTM feedback (Phase 6 —
> `ACTIVATION → OUTCOME → ATTRIBUTION → GTM LEARNING`: manually recorded
> outcome events, a frozen per-activation context snapshot, a factual account
> journey, and descriptive (never ranked) GTM analytics) are in place.
> **There is still no outbound sending integration and no autonomous
> activation or learning** — every draft requires a human to read it, edit it
> if needed, and approve it; "marking sent" is a plain, human-triggered
> database write, never an API call to LinkedIn/email/any external service;
> and outcomes are recorded manually, never inferred, with no automatic
> effect on scoring, ICP rules, or prompts. See `Build sequence` in the
> product spec for what's still ahead beyond Phase 6.

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind CSS v4 + shadcn/ui (Base UI primitives)
- PostgreSQL + Prisma ORM 7 (driver-adapter client, `@prisma/adapter-pg`)
- Zod for server-side validation of every mutation, CSV row, and AI model response
- Claude API (`@anthropic-ai/sdk`) for the research/GTM intelligence agents (behind a mockable `AIClient` interface — see **AI architecture** below)
- Deployment target: Vercel

## What's implemented

**Accounts** — list with search (company name / website / country) and filters
(country, company type, status, fleet size range, archived toggle); create,
edit, archive/restore (soft, reversible), and permanent delete (with a
confirmation dialog, cascades to contacts/signals/etc.).

**Contacts** — add, edit, and delete contacts from the account detail page;
fields include persona (linked to the `Persona` table) and a suggested (not
enforced) seniority vocabulary.

**CSV import** (`/import`) — a wizard for both accounts and contacts:
upload → parse → auto-detect column mapping (user confirms/corrects) →
validate → preview (with inline-editable cells and a per-row include
checkbox) → confirm → import. Nothing is written to the database before you
click "Import" on the preview screen. See **CSV import format** below.

**Account detail page** — Company Overview, Company Attributes, Contacts,
Signals, AI Intelligence, GTM Score (real — see below), Recommended Action,
Activation (real — generate/review/approve GTM activations, see below),
Outcome History and a GTM Journey (real — see below), Activity.

**Dashboard** — total accounts, total contacts, accounts with at least one
signal, and a recently-added-accounts list, all read live from the database.

**Scoring engine** (`lib/scoring/`) — a deterministic, five-dimension GTM
score (ICP Fit, Signal Strength, Problem Relevance, Buying Persona,
Engagement; 0-100 total). No LLM ever sets a numerical score. On the account
detail page, the Score Breakdown card shows the total, a bar per dimension,
and — for every dimension — the specific rules/signals/contacts that
contributed to it (never an AI-written summary). A "Recalculate Score" button
re-runs the engine on demand; it also re-runs automatically after account
create/edit and contact create/edit/delete. See **Scoring engine** below for
the full model.

**Opportunities** (`/opportunities`) — accounts ranked by total score, with
the factual contributing factors (ICP fit, latest signal, relevant product,
relevant persona) — never a "hot/best/worst" label.

**AI research & GTM intelligence** (`lib/ai/`, `lib/research/`) — an
explicitly user-triggered, two-step AI pipeline: a Research Agent that
synthesizes only the account's existing signals/contacts into a structured
report (never outside knowledge, `UNKNOWN` when unsupported), and a Why-Now
Agent that interprets the *deterministic* score into a plain-language
narrative, recommended next step, and stakeholder relevance — grounded so it
can only reference problems/products/personas that actually exist in the
scoring/config data. Every factual claim carries a `Source` + `Evidence` row
with a `FACT`/`INFERENCE`/`RECOMMENDATION` type. See **AI architecture** and
**Evidence model** below.

**External signal & research ingestion** (`lib/research-provider/`,
`lib/research/researchRun.ts`) — extends the pipeline one stage earlier:
SOURCE → FACT → SIGNAL → SCORE → INTELLIGENCE. A vendor-agnostic
`ResearchProvider` interface retrieves external documents; an AI Fact
Extraction Agent turns each into structured, source-cited `Fact` rows (never
outside knowledge, prompt-injection-resistant); a deterministic,
configuration-driven keyword layer turns facts into `Signal` rows (exact-match
deduplication — re-running research never creates duplicate signals); the
existing Phase 3 scoring engine is explicitly (never automatically)
recalculated when new signals appear; then the existing Phase 4 pipeline runs,
reused rather than duplicated. Every run is preserved as a `ResearchRun` row
(sources found, facts extracted, signals detected, score before/after,
per-step failures) — a new **Signals** page and a **What Changed** panel on
the account page are built on top of this history. See **External signal
ingestion** below.

**Production research provider** (`lib/research-provider/tavilyProvider.ts`,
`lib/research-provider/factory.ts`) — a real `ResearchProvider` (Tavily) sits
behind the same interface Phase 4.5 defined; switching vendors is an env var
(`RESEARCH_PROVIDER`) plus one new factory function, never a change to
`lib/research/researchRun.ts`. Research is now cached: re-clicking "Research
Account" within a configurable freshness window (default 24h) is a no-op
(`SKIPPED`, no external call at all) unless you explicitly click "Refresh
Research". Configurable budget limits (max documents per run, content size,
timeout, retries) are enforced in the orchestration layer, not inside any
provider. Retrieved documents are ranked by a deterministic source-quality
classification (official/primary, industry publication, secondary, unknown)
and the highest-quality ones survive the budget cap first. The account page
now shows a persistent status block (last researched, status, counts, score
before/after) and explains *why* when research is unavailable. See
**Production research provider** below.

**Human-approved GTM activation** (`lib/activation/`, `lib/ai/agents/activationAgent.ts`)
— an explicit `Activation` state machine (`DRAFT → PENDING_REVIEW → APPROVED → SENT`,
with `REJECTED`/`CANCELLED` side-exits) gates every draft behind human review
and approval before it can ever be marked sent — there is no sending
integration in this codebase. See **Human-approved GTM activation (Phase 5)**
below.

**Outcomes, attribution & GTM feedback** (`lib/outcomes/`, `lib/journey/`,
`lib/analytics/`) — `ACTIVATION → OUTCOME → ATTRIBUTION → GTM LEARNING`: an
append-only `OutcomeEvent` log records what actually happened after an
activation (manually, since there's still no sending/tracking integration), a
context snapshot frozen at each activation's generation time anchors every
outcome back to what was actually known when it was created, a factual
per-account **GTM Journey** merges every timestamped event into one feed, and
a global **`/outcomes`** history and **`/analytics`** dashboard present
descriptive counts/rates — never a ranking. See **Outcomes, attribution & GTM
feedback (Phase 6)** below.

## Project structure

```
app/
  (app)/                       route group for the authenticated shell (sidebar + pages)
    dashboard/
    accounts/
      actions.ts                server actions: account + contact CRUD
      research-actions.ts        server action: trigger the research/why-now pipeline
      page.tsx                  list, search, filters
      new/page.tsx
      [id]/page.tsx              detail (overview, contacts, signals, research, score, ...)
      [id]/edit/page.tsx
    import/
      actions.ts                 server actions: CSV import context + commit
      page.tsx                   tabs: Accounts / Contacts wizards
    opportunities/                real ranked-by-score view
    signals/                      all-accounts signal table, filterable
    activations/
      actions.ts                  server actions: generate/regenerate/edit/
                                   submit/approve/reject/mark-sent/cancel
      page.tsx                    global dashboard, grouped by status (not ranked)
    accounts/[id]/activations/[activationId]/page.tsx
                                   human review page (why this account / why
                                   now / who / what problem / what product /
                                   what action / draft / evidence / outcomes)
    outcomes/
      actions.ts                  server action: recordOutcomeEventAction
      page.tsx                    global outcome history, filterable
    analytics/
      page.tsx                    global GTM analytics (channel/angle/signal/
                                   persona/product) — descriptive, never ranked
components/
  ui/                            shadcn/ui primitives
  layout/                        app shell (sidebar nav)
  accounts/                      account form, filters, archive/delete actions,
                                  score breakdown, recalculate button, research
                                  button, research/why-now display panels,
                                  buying committee, claim-type badge, research
                                  run history, research status summary,
                                  what-changed panel, GTM journey feed
  contacts/                      contact form dialog, delete button
  import/                        CSV upload/mapping steps, per-entity wizards
  signals/                       signal list filters
  activations/                   status/channel badges, generate dialog,
                                  draft view/editor, workflow action buttons,
                                  account-level history list
  outcomes/                      outcome type badge, record-outcome dialog,
                                  account-level outcome history list, global
                                  filter bar
  analytics/                     the shared descriptive analytics table
config/
  meridian/                           MMS-specific config: signal taxonomy, personas,
                                  products, ICP rules, scoring rules, problem
                                  taxonomy (signal-type -> problem -> product),
                                  signal detection rules (fact -> signal type),
                                  research provider budget/freshness limits,
                                  source-quality classification, signal-category
                                  freshness expectations, activation channel
                                  definitions, outcome event type definitions
lib/
  validation/                    Zod schemas (account, contact, url, shared helpers)
  csv/                           field defs, column-mapping guesser, row validators
  accounts/, contacts/           service functions (used by both actions and tests)
  scoring/                       the deterministic scoring engine (see below)
  signals/                       display-only signal freshness labeling
                                  (separate from scoring's own decay math)
  ai/                            AIClient interface + Anthropic implementation,
                                  JSON extraction, Zod schemas, prompt builders,
                                  and the three agents (research, why-now, fact
                                  extraction)
  research-provider/             ResearchProvider interface, mock, the default
                                  "unconfigured" implementation, the real
                                  Tavily implementation, and the env-driven
                                  factory that selects between them
  research/                      the research pipeline (Phase 4, job/service
                                  abstraction) plus Phase 4.5/4.75's source
                                  ingestion, deterministic signal detection,
                                  freshness/caching, the outer research-run
                                  orchestrator, and the what-changed comparison
  activation/                    the approval state machine, context
                                  gathering (with the "never from account name
                                  alone" precondition), the frozen context
                                  snapshot builder, angle/cta extraction,
                                  generate/regenerate, and the transition
                                  functions (submit/approve/reject/mark-sent/
                                  cancel/edit)
  outcomes/                      server-side-validated outcome recording
                                  (recordOutcomeEvent) and filterable outcome
                                  queries for the /outcomes dashboard
  journey/                       read-only account journey aggregation across
                                  signals/scores/research runs/activations/
                                  outcomes into one factual, timestamped feed
  analytics/                     descriptive GTM analytics aggregation by
                                  channel/angle/signal type/persona/product
  db.ts                          Prisma client singleton (pg driver adapter)
  labels.ts                      UI label/variant maps for enums
prisma/
  schema.prisma
  seed.ts                        seeds config/meridian/* into the DB, plus demo accounts
tests/
  *.test.ts                      validation, CSV logic (pure, no DB)
  *.integration.test.ts          integration tests against the real DB
```

## Setup

1. **Node.js**: v20.9+ required (this repo was set up with v24 LTS via `nvm`).

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Database**: provision a PostgreSQL database (a free-tier hosted instance —
   e.g. [Neon](https://neon.tech) or [Supabase](https://supabase.com) — is
   recommended since deployment target is Vercel; a local Postgres works too).

   Copy `.env.example` to `.env` and set `DATABASE_URL`:

   ```bash
   cp .env.example .env
   ```

4. **Run migrations and seed data**

   ```bash
   npm run db:migrate   # applies prisma/migrations, creates the DB schema
   npm run db:seed      # seeds personas/products/ICP rules/scoring rules + demo accounts
   ```

5. **Run the app**

   ```bash
   npm run dev
   ```

   Visit http://localhost:3000 — it redirects to `/dashboard`.

## Database commands

| Command | What it does |
| --- | --- |
| `npm run db:migrate` | Create/apply a migration in dev (`prisma migrate dev`) |
| `npm run db:deploy` | Apply existing migrations without prompting (for CI/prod) |
| `npm run db:generate` | Regenerate the Prisma client after a schema change |
| `npm run db:studio` | Open Prisma Studio to browse data |
| `npm run db:seed` | Re-run `prisma/seed.ts` (idempotent for config rows; skips demo accounts if any account already exists) |

## CSV import format

Both the accounts and contacts importers accept a standard CSV with a header
row (comma-separated, quoted fields supported, e.g. `"Acme, Inc."`). Column
names don't need to match exactly — the wizard guesses a mapping from common
header variants and lets you correct it before anything is validated.

**Accounts** — recognized columns (aliases in parentheses):

| Field | Required | Aliases |
| --- | --- | --- |
| Company Name | yes | Company, Name, Account Name, Organization |
| Website | | URL, Domain, Company Website |
| Country | | HQ Country, Location |
| Company Type | | Type, Account Type |
| Fleet Size | | Fleet, Vessels, Number of Vessels |
| Vessel Types | | Vessel Type, Ship Types (comma/pipe/semicolon-separated list) |
| Regions | | Region, Operating Regions (comma/pipe/semicolon-separated list) |
| Status | | Pipeline Status (must be one of the `AccountStatus` values, e.g. `NEW`) |

**Contacts** — recognized columns:

| Field | Required | Aliases |
| --- | --- | --- |
| Account / Company Name | yes | Company, Account, Account Name, Organization — must match an **existing** account's name exactly (case-insensitive); the importer does not create accounts |
| Name | yes | Full Name, Contact Name |
| Title | | Job Title, Position |
| Department | | Dept |
| LinkedIn URL | | LinkedIn, LinkedIn Profile |
| Email | | Email Address, Work Email |
| Persona | | Buyer Persona, Role — matched by name against the `Persona` table; unrecognized values are a non-blocking warning, not an error |
| Seniority | | Seniority Level — free text; suggested values are `C_LEVEL`, `VP`, `DIRECTOR`, `MANAGER`, `INDIVIDUAL_CONTRIBUTOR` |
| Influence Score | | Influence — 0-100 |

**Validation behavior**: a row with an error (missing required field, malformed
email/URL, non-numeric fleet size, etc.) is marked **Invalid** and excluded
from import by default — it is never silently dropped, and its specific error
is shown inline so you can fix it in the preview table or exclude it
deliberately. A row whose company name (accounts) or email (contacts) matches
another row in the file or an existing database record is marked **Duplicate**
and excluded by default, but can be included anyway if you intend to create
it. Nothing is written to the database until you click the import button on
the preview screen.

## Scoring engine

`lib/scoring/` computes a 0-100 GTM score from five weighted dimensions. The
engine reads its rules from the database (`ICPRule`, `ScoringRule` — seeded
from `config/meridian/`) at score time; nothing is hard-coded, and no LLM ever
produces a numerical score.

| Dimension | Max | How it's computed |
| --- | --- | --- |
| ICP Fit | 25 | Each active `ICPRule` (field/operator/value/points) is evaluated against the account's own fields (`companyType`, `fleetSize`, `vesselTypes`, `regions`, `country`). A field with no data never matches, regardless of operator — missing data is never rewarded. |
| Signal Strength | 25 | Every non-ENGAGEMENT-category signal's effective contribution = `categoryPoints x decayFactor x (confidence/100) x (strength/5)`. Signals are never deleted for aging out — `decayFactor = 0.5^(ageDays / halfLifeDays)` continuously reduces old signals' weight. An expired signal (`expiresAt` in the past) contributes 0. Only the top `maxSignalsCounted` signals by effective points count toward the total. |
| Problem Relevance | 20 | `config/meridian/problems.ts` maps `Signal.type -> problem(s) -> product(s)` (e.g. `NEW_VESSEL -> MOORING_MANAGEMENT_COMPLEXITY -> MoorSense M4`). Each **distinct** problem evidenced by the account's signals earns points (capped at `maxMatches`), citing every signal that evidenced it. |
| Buying Persona | 15 | Only contacts with a real `Persona` **assigned** count — a generic job title is never inferred as a buying persona. Score is the single highest-tier match among contacts whose persona is in the configured relevant-persona list, not additive (a second VP doesn't double the signal). |
| Engagement | 15 | The higher of: the best decayed ENGAGEMENT-category signal (e.g. a demo request), or the best `Outcome` on any of the account's `Activity` rows (e.g. a booked meeting). Returns 0 when neither exists — engagement is measured, never invented. |

**Explainability**: every `Score` row's `componentDetails` JSON preserves the
full evidence trail per dimension (which rules matched, which signals counted
and by how much after decay, which problems/products were matched, which
contact won the persona match, which signal/outcome drove engagement) — the
account page's Score Breakdown card renders this directly.

**History**: `Score` has no unique constraint on `accountId` — every
computation creates a new row (`prisma.score.create`), so score history is
preserved. `Account.icpScore`/`currentScore` are a denormalized cache of the
*latest* score, updated in the same transaction, used for fast list/sort
(`/accounts`, `/opportunities`, dashboard).

**When it runs**: automatically after account create/edit and contact
create/edit/delete, and after CSV import (per imported/affected account); on
demand via the "Recalculate Score" button on the account page. Scoring
failures (e.g. missing seed config) never fail the underlying mutation — they
log and the account simply stays unscored until you retry.

**Determinism**: every dimension function takes an explicit `now: Date`
rather than reading the clock internally, so the same inputs always produce
the same output — this is what makes the engine unit-testable without mocking
time.

**The full 100/100 is genuinely reachable**: `config/meridian/problems.ts` defines
four problems (`MOORING_MANAGEMENT_COMPLEXITY`, `COMPLIANCE_READINESS`,
`DIGITAL_TRANSFORMATION_GAP`, `LEADERSHIP_TRANSITION_WINDOW` — the last
maps `LEADERSHIP_CHANGE`/`MARINE_LEADERSHIP_CHANGE`/`COMPLIANCE_LEADERSHIP_CHANGE`
signals to the real GTM heuristic that a new leader typically reassesses
existing vendors/tooling), matching `PROBLEM_RELEVANCE.maxMatches: 4` exactly.
`tests/scoring-engine.integration.test.ts` proves this end to end: an account
matching all five dimensions' rules scores exactly 100, with no artificial
normalization anywhere in the calculation.

## AI architecture

The core principle: **the deterministic system is what we know; the AI system
is what it means.** The AI layer never invents facts and never sets a score —
it interprets data the rest of the app already computed or recorded.

**`AIClient` interface** (`lib/ai/client.ts`) — `{ complete({ system, prompt,
maxTokens }): Promise<string> }`. `createAnthropicClient()` is the only piece
of this codebase that touches the network (Claude API, 45s timeout, wraps
every failure — including "no API key configured" — as a typed
`AIProviderError`). Every agent function and the pipeline take an `aiClient`
as a parameter; tests inject a fake one, so **no test in this repo requires
`ANTHROPIC_API_KEY` or network access** — confirmed by running the full suite
against this repo's actual `.env`, which has an empty key.

**Two agents, each a pure function `(aiClient, input) => Promise<Result>`:**

- `runResearchAgent` (`lib/ai/agents/researchAgent.ts`) — prompted to use
  *only* the account's own fields and existing `Signal` rows (which already
  carry `sourceUrl`/`sourceName`) — there is no live web access, so this is
  the only way to guarantee no fabrication. Returns `UNKNOWN`/empty arrays for
  anything unsupported.
- `runWhyNowAgent` (`lib/ai/agents/whyNowAgent.ts`) — prompted with the
  account's *already-computed* `Score` (never recomputed here — Phase 3's
  engine is untouched), the matched problems/products from
  `Score.componentDetails`, the latest research snapshot, and the full lists
  of active personas/products. It is instructed to reference only what it was
  given — and the function then **enforces that in code**, not just in the
  prompt: `groundResult()` filters out any `problemKey`, `productName`, or
  `personaName` the model returns that doesn't actually exist in the given
  context. A hallucinated reference is silently dropped, never persisted.

Two more agents follow the exact same pattern, documented in their own
sections below: the Fact Extraction Agent (**External signal ingestion**)
and the Activation Agent (**Human-approved GTM activation**).

**Failure handling** — every agent in this codebase throws one of three typed errors
(`lib/ai/errors.ts`): `AIProviderError` (network/timeout/no key),
`AIResponseParseError` (the model didn't return valid JSON — `extractJson()`
strips markdown fences first but never repairs malformed JSON), or
`AIResponseValidationError` (valid JSON that fails the Zod schema — e.g. a
bad `claimType` enum value). All three are **rejected, never coerced** — the
`researchResultSchema`/`whyNowResultSchema` `.safeParse()` calls fail closed.

**The pipeline as a job/service abstraction** (`lib/research/pipeline.ts`,
`runIntelligencePipeline(db, accountId, { aiClient })`) — a plain async
function, not tied to any request or queue mechanism. Today it runs
synchronously inside a server action; introducing a background queue later
means wrapping this exact function, not rewriting it. It writes a `PENDING`
`AccountInsight` row before calling the model, then updates it to `COMPLETED`
or `FAILED` — so a mid-flight crash leaves visible, honest evidence of what
happened rather than silent data loss. Research failure short-circuits the
run (Why-Now is skipped, since it depends on the research snapshot); a
Why-Now failure still preserves the completed research. **Research is never
triggered automatically** — only the "Research Account"/"Refresh Research"
button on the account page calls it.

## Evidence model

`Source` (a citation: URL, name, publisher, publication date, retrieval date,
type) and `Evidence` (a specific claim tied to one `Source`, with a
`claimType`) are the reusable structures both agents write into. `ClaimType`
is a real enum — `FACT`, `INFERENCE`, `RECOMMENDATION` — enforced at the
database level, not just a UI label:

- **FACT** — directly stated in the provided signals/account data.
- **INFERENCE** — an AI-drawn synthesis across multiple data points. Never
  stored or displayed as though it were verified.
- **RECOMMENDATION** — a suggested action, not a claim about reality.

`AccountInsight` (`kind: RESEARCH | GTM_INTELLIGENCE`) is the persisted
snapshot: `status` (`PENDING`/`COMPLETED`/`FAILED`), `provider`, `model`,
`promptVersion`, `content` (the validated JSON, `null` until completed),
`error`, `generatedAt`. **History is never overwritten** — each run creates a
new row (no unique constraint on `accountId` + `kind`), exactly like `Score`
in Phase 3.

## External signal ingestion (Phase 4.5)

Extends the evidence model one stage earlier — **SOURCE → FACT → SIGNAL →
SCORE → INTELLIGENCE** — without collapsing any of those into each other:

**`ResearchProvider`** (`lib/research-provider/types.ts`) — `{ search({
companyName, website }): Promise<RetrievedDocument[]> }`. Business logic
depends only on this interface, exactly like `AIClient`. Two implementations
ship: `createMockResearchProvider()` (tests — a static list, a function for
per-call responses, or an `Error` to simulate an outage) and
`createUnconfiguredResearchProvider()` (the default "real" one — fails with a
clear `ResearchProviderError` rather than a silent empty success, since no
specific vendor is wired in yet; plugging one in is writing one function and
passing it into `runResearchWorkflow`, no other code changes).

**`Source`** persists what was retrieved (URL, title, publisher, publication
date, retrieval date, type, and `rawContent`) — **sources are never silently
replaced**: the same URL found again reuses the existing row, preserving what
was actually retrieved the first time (`resolveOrCreateSource` in
`lib/research/sourceIngestion.ts`).

**`Fact`** is a new, genuinely distinct model (not reused/collapsed into
`Evidence`) — a structured statement extracted from one `Source` by the AI
Fact Extraction Agent (`lib/ai/agents/factExtractionAgent.ts`), with
`statement`, `confidence`, and `context` (date/situational context, if
given). The extraction prompt (`lib/ai/prompts/factExtraction.ts`) treats
document content as **untrusted external input**: it's clearly delimited as
data, the model is explicitly instructed never to follow instructions found
inside it (a real prompt-injection defense, not just a formatting choice),
and — like every other agent — output is Zod-validated and rejected rather
than coerced on failure.

**Signal detection is deterministic and configuration-driven**
(`config/meridian/signalDetection.ts`, `lib/research/signalDetection.ts`): each
`Fact`'s statement is tested against case-insensitive keyword rules per
signal type — no fuzzy matching, no model call. A fact can match multiple
rules (e.g. "appointed a new Head of Compliance" evidences both
`LEADERSHIP_CHANGE` and `COMPLIANCE_ACTIVITY`). **Duplicate detection** uses
an explicit, replaceable identity — `(accountId, type, sourceId)` — so
re-running research against an already-seen source never creates a second
copy of the same signal. Every created `Signal` gets an `Evidence` row in the
same call that created it (`createSignalFromFact`) — a signal is never
created without evidence, structurally, not by convention. `Signal.status`
(`ACTIVE`/`EXPIRED`/`ARCHIVED`) is set at creation; ongoing freshness/decay
is still computed dynamically by the Phase 3 scoring engine, not by a
background job flipping this column — signals are never deleted either way.

**Score recalculation is explicit and conditional**
(`lib/research/researchRun.ts`) — Phase 3's `computeAndSaveAccountScore` is
called only when at least one new signal was actually detected this run,
never on an arbitrary page read. `ResearchRun.scoreBefore`/`scoreAfter`
record the before/after regardless, so "did this research meaningfully move
the account" is always answerable.

**The research run** (`runResearchWorkflow`) reuses the Phase 4 pipeline
verbatim as its last step — it does not duplicate research/why-now logic.
Every step (retrieval, per-document extraction, score recalculation, the
Phase 4 pipeline) is independently fault-tolerant: a failure is recorded in
`ResearchRun.errors` (`{ step, message }[]`) and the run continues, ending
`COMPLETED`, `PARTIAL`, or `FAILED` depending on what actually succeeded.
**Every run is its own row — history is never overwritten**, which is what
powers **What Changed** (`lib/research/whatChanged.ts`): comparing the two
most recent runs for new signals, newly-expired signals, the score delta,
and new items in the research narrative — kept deliberately factual, no
synthesized commentary.

## Production research provider (Phase 4.75)

**One real vendor, behind the same interface** — `createTavilyResearchProvider()`
(`lib/research-provider/tavilyProvider.ts`) implements `ResearchProvider`
against [Tavily](https://tavily.com). `lib/research/researchRun.ts` never
imports it directly; it calls `createConfiguredResearchProvider()`
(`lib/research-provider/factory.ts`), which reads `RESEARCH_PROVIDER` and
picks the implementation. Adding a second vendor is one new factory file plus
one new `case` in that switch — nothing in the orchestration, scoring,
signals, or AI-agent code ever needs to know which vendor is active, per the
explicit constraint for this phase.

**Caching / freshness** (`lib/research/freshness.ts`) — `checkResearchFreshness`
looks at the most recent `COMPLETED`/`PARTIAL`/`SKIPPED` run (a `FAILED` run
never counts — it produced nothing to be fresh about, so retrying immediately
is always allowed) and compares its age to a configurable window
(`RESEARCH_FRESHNESS_WINDOW_HOURS`, default 24h, `config/meridian/researchProvider.ts`).
`runResearchWorkflow` now takes a `{ force }` option: "Research Account" (no
prior research) passes `force: false` — trivially not fresh, always proceeds.
"Refresh Research" passes `force: true`, the **only** way to bypass the
window per the spec. A skipped run still creates a `ResearchRun` row
(`status: SKIPPED`) recording *why*, rather than silently doing nothing — the
account page and Research History both show it.

**Research budget** (`config/meridian/researchProvider.ts`, enforced in
`lib/research/researchRun.ts` and `lib/research/sourceIngestion.ts` — the
orchestration layer, not any specific provider) — `maxSearchesPerRun` (1, for
the current single-query providers), `maxDocumentsPerRun` (5 — retrieved
documents beyond this are dropped, preferring the highest-quality ones, not
an error), `maxContentChars` (8,000 — every document is capped before it's
persisted *or* reaches a prompt, regardless of whether the provider already
truncated it), `requestTimeoutMs` (15s, `AbortController`), and `retryCount`
(2, for transient failures only — auth/rate-limit errors are never retried,
since retrying can't fix them).

**Failure handling** — `ResearchProviderError` now carries a `kind`:
`AUTH`, `TIMEOUT`, `RATE_LIMIT`, `UNAVAILABLE`, `MALFORMED_RESPONSE`,
`NOT_CONFIGURED`. Every one of these is a *failure*, recorded in
`ResearchRun.errors`, never silently converted into "found 0 documents" — an
actually-empty result set (the provider ran fine and found nothing) is
represented identically in the data model but is reached only via a
successful return, never a caught exception, so the two are never confused.

**Source quality** (`config/meridian/sourceQuality.ts`, `Source.quality`) —
`OFFICIAL_PRIMARY` (company website, regulatory filing, vetting database),
`INDUSTRY_PUBLICATION` (a small allowlist of recognized maritime trade
publication domains), `SECONDARY` (general news/press-release/LinkedIn from
an unrecognized outlet), or `UNKNOWN`. Computed deterministically, never by a
model. Retrieved documents are sorted by this classification before the
`maxDocumentsPerRun` cap is applied, so authoritative sources are preferred
when a run has to drop some. This is completely independent of
`Evidence.claimType` (FACT/INFERENCE/RECOMMENDATION) — source authority and
claim verifiability are different questions, and this phase keeps them that
way.

**Signal freshness expectations** (`config/meridian/signalFreshness.ts`,
`lib/signals/freshness.ts`) — a per-category "how long should this stay
relevant" reference table, used only for a display-only FRESH/AGING/STALE
badge (Signals page, account Signals card). It is read nowhere near
`lib/scoring/` — Phase 3's decay math continues to run entirely off each
`Signal`'s own `decayHalfLifeDays`/`expiresAt`, independent of this config,
exactly as the spec requires.

**Account page UX** — the Research card now opens with a persistent status
block (`ResearchStatusSummary`): last researched, status, sources found,
facts extracted, signals detected, score before → after, and — when status
is `FAILED`/`PARTIAL`/`SKIPPED` — the specific reason, not just a generic
"unavailable."

## Human-approved GTM activation (Phase 5)

The core principle: **INTELLIGENCE → RECOMMENDATION → DRAFT → HUMAN REVIEW →
APPROVAL → ACTIVITY.** This is explicitly *not* an autonomous outbound
system — an `Activation` is a piece of draft content that a human must read,
optionally edit, and explicitly approve before it can ever be marked sent.
There is no code path in this phase that sends anything anywhere.

**The `Activation` model** (`prisma/schema.prisma`) — belongs to an
`Account` (cascade-deleted with it) and optionally a `Contact` (nullable —
`SALES_BRIEF`/`CONTENT_RECOMMENDATION` are internal, not addressed to
anyone). Fields: `channel` (`ActivationChannel` enum), `status`
(`ActivationStatus` enum), `objective`, `content` (`Json`, channel-specific
shape), `reasoning` (always shown next to the draft, never hidden),
`evidenceIds` (`String[]` — grounded `Evidence.id` values only, see below),
`sourceInsightId` (the Why-Now insight it was generated from, if any),
`provider`/`model`/`promptVersion`, `regeneratedFromId`/`version` (see
**Regeneration**), and `approvedBy`/`approvedAt`/`rejectedAt`/`sentAt`.

**Approval state machine** (`lib/activation/statusTransitions.ts`) —
`DRAFT -> PENDING_REVIEW -> APPROVED -> SENT`, with `REJECTED` and
`CANCELLED` as terminal side-exits. A single `ALLOWED_TRANSITIONS` table plus
`assertTransition()` is the *only* way any code path changes
`Activation.status` — every transition function in
`lib/activation/transitions.ts` calls it first, so illegal transitions
(`DRAFT -> SENT` skipping review, a `REJECTED` row somehow becoming
`SENT`, any status transitioning to itself) are structurally impossible, not
just conventionally avoided. `REJECTED`, `SENT`, and `CANCELLED` all have zero
outgoing transitions.

**Generation requires real context, never "account name alone"**
(`lib/activation/context.ts`, `gatherActivationContext`) — assembles the
account's latest `Score` (with its matched problems/products from
`componentDetails`), the latest completed Why-Now `AccountInsight`, the
latest completed Research snapshot, the contact (with persona) if one was
selected, and up to 30 recent `Evidence` rows. If an account has **none** of
a score, completed Why-Now intelligence, or evidence — `generateActivation`
throws `InsufficientActivationContextError` before ever calling the model,
rather than letting the AI draft something ungrounded from nothing.

**Four channels, extensible via config** (`config/meridian/activationChannels.ts`)
— `LINKEDIN`/`EMAIL` (outbound, require a contact, share an
`{ angle, message, cta }` content shape) and `SALES_BRIEF`/
`CONTENT_RECOMMENDATION` (internal, no contact required, each with its own
distinct content shape — a sales brief is never forced into the same
`message`/`cta` shape as outbound copy). Adding a fifth channel is a new
entry here, a new Prisma enum value, and a new Zod content schema — not a
scattered set of edits.

**The Activation Agent** (`lib/ai/agents/activationAgent.ts`,
`runActivationAgent(aiClient, input)`) — a pure function behind the same
`AIClient` interface as the Research/Why-Now/Fact-Extraction agents, so
**no test in this repo requires a live model call to exercise it**. The
prompt (`lib/ai/prompts/activation.ts`) hard-codes message-fabrication-
avoidance rules directly in the system prompt: be specific to the account,
never invent statistics/events/technologies not given, never claim private
knowledge, never fabricate a prior customer relationship or outcome, cite
evidence only by the exact `id` values it was given, and `confidence`
reflects evidentiary support, not persuasiveness. The response is Zod-
validated per channel (`getActivationResultSchema(channel)`,
`lib/ai/schemas/activation.ts`) and — like every other agent in this
codebase — **rejected, never coerced** on a malformed or schema-invalid
response.

**Evidence grounding is enforced in code, not just prompted**
(`lib/activation/generate.ts`) — after the model returns, `evidenceUsed` is
filtered against the real `Evidence.id` values that were actually given to
it for that account; any id the model invents (a hallucinated citation) is
silently dropped before the `Activation` row is ever created. The persisted
`evidenceIds` therefore can only ever contain ids that genuinely exist.

**Generation is all-or-nothing and strictly read-only** — a single
synchronous AI call, unlike the multi-step `ResearchRun` pipeline, so a
failure (insufficient context, provider error, malformed/invalid model
output) persists **no** `Activation` row at all rather than a partial
`FAILED` record. It only ever *reads*
`Account`/`Contact`/`Score`/`AccountInsight`/`Signal`/`Evidence` and writes
exactly one new `Activation` row — generating a draft never mutates a score,
signal, contact, fact, or research record (proven directly by
`tests/activation-generate.integration.test.ts`'s before/after snapshot
comparison across all of those tables).

**Human review UI**
(`app/(app)/accounts/[id]/activations/[activationId]/page.tsx`) — presents,
in this order, exactly the information hierarchy the spec requires: why this
account (score + matched problems), why now (Why-Now narrative), who (the
contact/persona, if any), what problem, what product, what action
(objective), the draft itself (editable while `DRAFT`/`PENDING_REVIEW`), and
the grounded evidence it cites. Actions available depend on status:
Submit for Review, Edit, Regenerate, Approve, Reject, Mark Sent, Cancel —
each simply calls its corresponding server action in
`app/(app)/activations/actions.ts`, which delegates straight to the
transition/generation functions above (no business logic lives in the
server actions themselves).

**Regeneration versions, never overwrites**
(`lib/activation/regenerate.ts`) — creates a brand-new `Activation` row
(`status: DRAFT`, `version: previous.version + 1`, `regeneratedFromId`
pointing at the row it superseded) using the same context-gathering and
grounding path as `generateActivation`. The original row is left completely
untouched — still whatever status it was in, still holding its own content,
reasoning, and evidence — so a full history of every draft ever produced for
an account survives, and a regenerated draft must independently pass through
`PENDING_REVIEW` again; it does not inherit its predecessor's review state.

**Activation History and the `/activations` dashboard**
(`components/activations/activation-history.tsx`,
`app/(app)/activations/page.tsx`) — the account page shows every activation
ever generated for that account, oldest to newest, each with its
channel/status/version. The global `/activations` dashboard groups every
activation across all accounts by status (`DRAFT`, `PENDING_REVIEW`,
`APPROVED`, `SENT`, `REJECTED`, `CANCELLED`) — explicitly **not** ranked or
scored against each other; reviewing what needs a decision is a queue, not a
leaderboard.

**No external send integration exists in this phase, by design** —
`markActivationSent` (`lib/activation/transitions.ts`) takes no `AIClient`,
no `fetch`, no network dependency of any kind. It is a plain database write
that records `sentAt` and flips `status` to `SENT`, reachable only from
`APPROVED` (enforced by `assertTransition`). Sending mechanics (LinkedIn API,
email delivery, etc.) are explicitly out of scope for Phase 5.

## Outcomes, attribution & GTM feedback (Phase 6)

The core principle: **ACTIVATION → OUTCOME → ATTRIBUTION → GTM LEARNING.**
This phase closes the loop on Phase 5's activations by recording what
actually happened, but explicitly does **not** build autonomous optimization
— nothing here ever changes scoring weights, ICP rules, signal importance,
activation copy rules, or prompts. Every learning happens in a human's head
when they read the analytics; the system only records and aggregates.

**`OutcomeEvent`** (`prisma/schema.prisma`) — a genuinely distinct model from
the pre-existing Phase 2/3 `Activity`/`Outcome` pair (which is
Activity-scoped and feeds only the scoring engine's Engagement dimension).
`OutcomeEvent` is keyed directly to `Account` (required), `Contact`
(optional), and `Activation` (optional — an outcome can be recorded at the
account level without tying it to one specific draft, e.g. a deal closing
weeks after several activations). Fields: `type` (`OutcomeEventType` enum —
`DELIVERED`, `OPENED`, `CLICKED`, `REPLIED`, `POSITIVE_REPLY`,
`NEGATIVE_REPLY`, `MEETING_BOOKED`, `MEETING_HELD`, `OPPORTUNITY_CREATED`,
`OPPORTUNITY_WON`, `OPPORTUNITY_LOST`, `NO_RESPONSE`, `UNSUBSCRIBED`),
`occurredAt`, `source` (always `"manual"` today — no capture integration
exists), and optional `metadata`. It is **append-only** — there is no
"current outcome status" field anywhere; an activation can accumulate any
number of these rows, and recording one never overwrites or removes another
(`config/meridian/outcomeTypes.ts` holds the label/description per type, so a new
lifecycle event is one enum value plus one config entry, never a scattered
set of edits — the same extensibility pattern as `ActivationChannel`).

**The context snapshot** (`lib/activation/snapshot.ts`,
`Activation.contextSnapshot`) — frozen once, at generation/regeneration time,
by reusing the scoring engine's own `Score.componentDetails` wholesale rather
than re-deriving a parallel shape: `componentDetails.signalStrength.signals`
and `componentDetails.problemRelevance.matchedProblems` (with their nested
`relevantProducts`) already **are** the "signals" and "relevant
problems/product" data this snapshot needs. Combined with the contact/persona,
the evidence list, and the Why-Now/research snapshots, this one JSON column
answers every item Phase 6 asks a snapshot to cover. It is **never
reconstructed from current records later** — `tests/activation-context-snapshot.integration.test.ts`
proves this directly: an account's score can change dramatically after an
activation is generated, and the activation's own frozen snapshot still shows
exactly what was known at the moment it was created. `angle`/`cta` are also
denormalized onto `Activation` at the same moment (out of the channel-specific
`content` shape — `angle`/`cta` for LINKEDIN/EMAIL, `contentAngle`/`suggestedCta`
for CONTENT_RECOMMENDATION, both `null` for SALES_BRIEF) purely so analytics
can group by them without parsing per-channel JSON at query time; editing a
draft's content re-derives them in the same call, so they can never drift out
of sync with what's actually in `content`.

**Attribution uses explicit relationships only, never probabilistic
matching** (`lib/outcomes/record.ts`, `recordOutcomeEvent`) — every
account/contact/activation relationship a client submits is re-verified
server-side against the database before the event is written: a given
`contactId` must actually belong to the given `accountId`, and a given
`activationId` must actually belong to the given `accountId` — attaching an
outcome to an unrelated account or activation is rejected
(`OutcomeValidationError`), never silently allowed. `type` and `metadata` are
Zod-validated (`lib/outcomes/record.ts`) and rejected — not coerced — on an
invalid shape. Recording an outcome is a single `OutcomeEvent` insert; it is
proven, not just asserted, to never mutate `Fact`/`Source`/`Signal`/`Score`/
`AccountInsight`/`Activation` rows (`tests/outcome-recording.integration.test.ts`).

**Outcome capture UI** (`components/outcomes/record-outcome-dialog.tsx`) — a
"Record Outcome" dialog usable two ways: from an Activation review page
(`activationId` fixed, so the event is directly attributable to that draft)
and from the account page (no `activationId` — an account-level outcome).
Multiple events can be recorded against the same activation; there is no
external sending API anywhere in this flow, since Phase 6 explicitly does not
build one.

**The GTM Journey** (`lib/journey/accountJourney.ts`,
`components/accounts/gtm-journey.tsx`) — a read-only aggregation (no new
source of truth) that merges every table that already records a real,
timestamped GTM event — `Signal.detectedAt`, `Score.computedAt`,
`ResearchRun.startedAt`, `Activation.createdAt`/`approvedAt`/`sentAt`, and
`OutcomeEvent.occurredAt` — into one reverse-chronological feed on the
account page. Every line is a plain restatement of a stored field; **no
causality is invented**. A score entry only claims "recalculated as part of a
research run" when a `ResearchRun` for that account recorded that exact score
value as its own after-state at essentially the same moment — anything looser
is omitted rather than guessed.

**Score history** is exposed directly in the journey (every `Score` row ever
computed, in order, each showing the previous → new total) — `Score` already
has no unique constraint on `accountId` (Phase 3), so this is pure surfacing
of existing history, nothing new to preserve.

**GTM Analytics** (`lib/analytics/gtmAnalytics.ts`, `/analytics`) —
descriptive, factual aggregation by activation channel, activation angle,
signal type, persona, and product, each showing accounts/activations/sent
activations/replies/positive replies/meetings/opportunities plus descriptive
rates (a rate is `null`, never a fabricated `0%`, when there are zero sent
activations to compute it against). Buckets are always sorted alphabetically
by key — **never** by a metric, and never labeled "best"/"worst"/"top". A
`POSITIVE_REPLY` event counts toward both "replies" and "positive replies" (a
positive reply is still a reply). `computeGtmAnalytics` accepts an optional
`accountIds` filter — the global `/analytics` page omits it (aggregates
everything); it exists so a future account-scoped view (or a test) can get a
fully deterministic, isolated slice instead of reading the whole table.

**Outcome History** (`lib/outcomes/queries.ts`, `/outcomes`) — every recorded
outcome event, filterable by type, channel, account, persona, product, and
date range. Persona/product filtering reads each outcome's activation's
frozen `contextSnapshot` (the durable attribution surface this phase is built
on), not the account's *current* contacts/products. Every count on the page
is a real query result — nothing estimated or placeholder.

**No automatic learning, anywhere in this phase** — there is no code path
that reads an outcome or an analytics aggregate and then writes back to
`ScoringRule`, `ICPRule`, `config/meridian/*`, or any AI prompt. Closing that loop
(if it happens at all) is a deliberate future decision a human makes after
looking at `/analytics`, not something this phase automates.

## UI: verified vs. interpreted vs. recommended

Per the design brief, these three are never presented as equivalent:

- **Verified/sourced** (Company Attributes, Contacts, Signals, and any
  `FACT`-type Evidence row) — plain card styling, no special badge. This
  *is* the "came from a deterministic system" signal.
- **AI interpretation** (Research summary, Why-Now narrative, `INFERENCE`
  evidence) — wrapped in `<AiInterpretationPanel>`, a dashed-border, tinted
  container labeled "AI interpretation — not independently verified" with a
  sparkle icon, everywhere it appears.
- **Recommended action** — its own bordered panel with a `RECOMMENDATION`
  badge and an explicit "a suggestion for a human to act on — not an
  automated action" caption.

Buying Committee wording is constrained to `relevant stakeholder` /
`potential stakeholder` / `potential evaluator` / `potential operational
stakeholder` — enforced by the Zod enum, not just prompt instructions. The
model is never permitted to say "decision maker."

## Configuration vs. core logic

Everything specific to Meridian Marine Systems — the signal taxonomy,
personas, product catalogue, ICP scoring rules, dimension-weighting rules, and
the problem taxonomy — lives under `config/meridian/` as plain data, and is loaded
into the DB (`Persona`, `Product`, `ICPRule`, `ScoringRule` tables) by
`prisma/seed.ts`. `Signal.type`/`Signal.category` are plain validated strings,
not Prisma enums. The only things the scoring engine itself hard-codes are the
five dimension names and their point caps (`lib/scoring/constants.ts`) — that
0-100 rubric shape is a structural contract of the product, not a per-vertical
assumption. Every rule, weight, decay half-life, and signal-to-problem mapping
is configuration the engine reads at score time; retargeting the whole engine
at a different vertical means replacing `config/meridian/` (and re-seeding), not
touching `lib/scoring/`.

## Testing

```bash
npm test
```

Runs Node's built-in test runner (`tsx --test`) over `tests/**/*.test.ts`:

- Pure validation tests for the account/contact Zod schemas (no DB).
- Pure tests for CSV column-mapping and row validation/duplicate-detection
  logic (no DB).
- Integration tests for account/contact service functions (`lib/accounts/service.ts`,
  `lib/contacts/service.ts`) against the **real** database configured in
  `DATABASE_URL` — each test creates its own throwaway row(s) and deletes them
  in a `finally` block, so seeded demo data is never touched.
- Pure tests for each scoring dimension (`tests/scoring-*.test.ts`): ICP rule
  evaluation per operator, signal decay/expiration, top-N signal selection,
  problem-relevance matching/dedup, persona-tier matching (including that a
  bare job title never counts), and engagement's signal-vs-outcome max —
  including boundary cases (zero signals, expired signal, no contacts, max
  achievable score, minimum score) and explicit determinism checks (same
  input -> same output).
- An integration test suite for the full engine
  (`tests/scoring-engine.integration.test.ts`) against the real database:
  end-to-end total calculation, that saving a score twice creates two rows
  (history is preserved, never overwritten), and that the `Account`
  denormalized cache is updated correctly.
- Pure tests for both AI agents (`tests/ai-research-agent.test.ts`,
  `tests/ai-why-now-agent.test.ts`) using a fake `AIClient` — no network, no
  API key: valid/empty/malformed/schema-invalid model responses, markdown-
  fenced JSON extraction, provider-error propagation, and (why-now
  specifically) that a hallucinated problem/product/persona reference is
  dropped by `groundResult()`.
- An integration test suite for the full pipeline
  (`tests/research-pipeline.integration.test.ts`) against the real database
  with a fake `AIClient` injected: evidence correctly associated with FACT vs.
  INFERENCE claim types, an all-`UNKNOWN` research result completing
  successfully, a simulated API failure producing a `FAILED` insight without
  a crash or corrupted account fields, a why-now failure preserving the
  completed research snapshot, two runs preserving history (four insight rows,
  none overwritten), and that running research leaves the account's `Score`
  rows and denormalized cache completely unchanged.
- Pure tests for the `ResearchProvider` abstraction (`tests/research-provider.test.ts`)
  — the mock provider (static list, per-call function, simulated failure) and
  the unconfigured default both satisfy the same interface.
- Pure tests for the Fact Extraction Agent (`tests/ai-fact-extraction-agent.test.ts`)
  — valid/empty/malformed/schema-invalid responses, mirroring the other two
  agents.
- Pure tests for deterministic signal detection (`tests/signal-detection.test.ts`)
  — keyword matching (case-insensitive), no match, and a single fact matching
  multiple rules.
- A large integration suite for the full research-run workflow
  (`tests/research-run.integration.test.ts`) against the real database with a
  mock provider and a queued fake `AIClient`: source/fact/signal/evidence
  persistence end to end, exact-match duplicate signal detection across two
  runs of the same source, one document's extraction failure not aborting
  processing of the others, the "no provider configured" degraded path still
  completing the intelligence pipeline, score recalculation happening only
  when new signals exist (and leaving the score untouched when they don't),
  and research-run history surviving three consecutive runs.
- Integration tests for the What Changed comparison
  (`tests/what-changed.integration.test.ts`) — no comparison with fewer than
  two runs, correct score-delta/new-signal reporting, newly-expired-signal
  detection, and new-research-finding diffing between two runs.
- Pure tests for the provider factory (`tests/research-provider-factory.test.ts`)
  — `RESEARCH_PROVIDER=tavily` actually selects the Tavily implementation, no
  env var falls back to unconfigured, and an unrecognized value falls back
  rather than crashing.
- Pure tests for the real Tavily provider (`tests/tavily-provider.test.ts`)
  with an injectable `fetchImpl` — **no network call is ever made**: missing
  API key, a successful response mapped correctly, an empty result set
  (valid, not an error), 401→AUTH, 429→RATE_LIMIT, 5xx→UNAVAILABLE,
  non-JSON/missing-`results`→MALFORMED_RESPONSE, a network error retried the
  configured number of times before failing, a transient failure followed by
  success still succeeding, and that results are capped/truncated to the
  configured budget.
- Pure tests for source-quality classification (`tests/source-quality.test.ts`)
  and signal-freshness labeling (`tests/signal-freshness.test.ts`).
- Integration tests for the freshness/caching behavior
  (`tests/research-freshness.integration.test.ts`,
  `tests/research-run-freshness.integration.test.ts`) against the real
  database: no prior research is never fresh, a completed run within the
  window is fresh, a `FAILED` run never counts as fresh, a second
  `runResearchWorkflow` call within the window is `SKIPPED` and **provably
  makes zero AI calls** (the test's fake client throws if called at all),
  `force: true` always bypasses the window, a custom window is honored, and a
  skipped run still records `scoreBefore === scoreAfter`.

- Pure tests for the Activation Agent (`tests/ai-activation-agent.test.ts`)
  using a fake `AIClient` — a valid response for each of the 4 channels
  (asserting each channel's genuinely distinct content shape, not one generic
  envelope), malformed (non-JSON) output, a response shaped for the wrong
  channel being rejected, a missing required content field being rejected,
  and an out-of-range confidence value being rejected rather than clamped.
- Pure tests for the approval state machine
  (`tests/activation-status-transitions.test.ts`) — the full documented
  happy path (`DRAFT -> PENDING_REVIEW -> APPROVED -> SENT`), that `SENT` is
  reachable only from `APPROVED` and never directly from `DRAFT`/
  `PENDING_REVIEW`, that `REJECTED`/`SENT`/`CANCELLED` all have zero outgoing
  transitions (checked against every possible target status), that a status
  can never transition to itself, and that `assertTransition` throws/doesn't
  throw exactly when `canTransition` says it should.
- An integration suite for generation
  (`tests/activation-generate.integration.test.ts`) against the real
  database: generation refuses an account with no score, no Why-Now
  intelligence, and no evidence (`InsufficientActivationContextError`);
  proceeds once at least a score exists; a hallucinated evidence id in the
  model's response is dropped while a real one is kept; account/contact
  association is stored correctly; a full before/after snapshot comparison
  across `Score`/`Signal`/`Contact`/`Fact`/`AccountInsight`/`Account` proving
  generation never mutates any of them; and that a failed generation
  (malformed AI output) persists zero `Activation` rows.
- An integration suite for the approval workflow
  (`tests/activation-workflow.integration.test.ts`) against the real
  database: a newly generated activation starts `DRAFT`; approval sets
  `approvedAt`/`approvedBy`; rejection sets `rejectedAt` and a rejected
  activation can never subsequently be marked sent; `DRAFT` cannot jump
  directly to `SENT` or `APPROVED`; marking an activation `SENT` makes no
  external call of any kind (the test asserts this by never providing one);
  cancellation works from `DRAFT`/`PENDING_REVIEW`/`APPROVED`; regeneration
  creates a genuinely new row, leaving the original completely untouched
  (asserted via a full deep-equal snapshot) and independently versioned;
  editing content is allowed while `DRAFT`, rejected once `APPROVED`
  (`ActivationNotEditableError`), and rejected when the new content doesn't
  match the channel's schema.
- An integration suite for outcome recording
  (`tests/outcome-recording.integration.test.ts`) against the real database:
  a valid outcome event is created with the given type/date/metadata;
  multiple events can be recorded against the same activation; account/
  contact/activation association is stored correctly; an account-level
  outcome (no activation) is valid; a contact belonging to a *different*
  account is rejected (`OutcomeValidationError`); an activation belonging to
  a different account is rejected; a nonexistent account is rejected; an
  invalid outcome type and an unexpected metadata shape are both rejected
  rather than coerced; and recording an outcome is proven, via a full
  before/after snapshot, to never mutate `Score`/`Activation`/`Account` rows.
- An integration suite for the context snapshot
  (`tests/activation-context-snapshot.integration.test.ts`): the snapshot
  correctly captures the score/matched-problems/contact known at generation
  time; the snapshot is proven **frozen** — recomputing the account's score
  dramatically higher *after* generation never changes what an already-
  generated activation's snapshot reports; angle/cta extraction is verified
  per channel (LINKEDIN/EMAIL use `angle`/`cta`, CONTENT_RECOMMENDATION uses
  `contentAngle`/`suggestedCta`, SALES_BRIEF has neither); and an outcome
  event recorded against an activation survives that activation's
  regeneration, staying attributed to the original version only (the
  regenerated version starts with zero outcomes of its own).
- An integration suite for the account journey
  (`tests/account-journey.integration.test.ts`) with deterministic, explicitly
  timestamped fixtures across every entry type (signal, score x2, research
  run, activation generated + approved, outcome): asserts strict newest-first
  ordering, that every entry type appears, the exact previous→new score
  transition text, and the research run's factual (never invented) score-
  delta context. A second test confirms an account with no events yields an
  empty journey, not an error.
- An integration suite for GTM analytics
  (`tests/gtm-analytics.integration.test.ts`): three fixture activations
  across two accounts, several outcome events, and `computeGtmAnalytics`'s
  `accountIds` filter (scoping the aggregation to exactly these fixtures, so
  the assertions are deterministic regardless of any other concurrently-
  running test file's activations) — verifies exact counts/rates per channel/
  angle/signal-type/persona/product, that a rate is `null` (never a
  fabricated `0%`) with zero sent activations, and that `POSITIVE_REPLY`
  correctly counts toward both "replies" and "positive replies". A second
  test asserts every dimension's buckets are sorted alphabetically by key —
  never by a metric, so no bucket can read as implicitly "ranked."

**No live external service is required for `npm test`** — verified by running
the full suite (224 tests) against this repo's actual `.env`, which has an
empty `RESEARCH_PROVIDER` (defaults to `unconfigured`); every Phase 5/6
integration test injects a fake `AIClient` or skips the AI layer entirely
even though a real `ANTHROPIC_API_KEY` happens to be configured in this
environment for the Research/Why-Now agents' live use from the UI.

## Environment variables

See `.env.example`:

- `DATABASE_URL` — PostgreSQL connection string (direct, non-pooled — used for migrations and local dev)
- `DATABASE_URL_POOLED` — optional pooled connection string, recommended for serverless runtime (Vercel)
- `ANTHROPIC_API_KEY` — Claude API key. Used by `createAnthropicClient()` for
  the Research, Why-Now, Fact Extraction, and Activation agents (the
  "Research Account"/"Refresh Research" buttons and the "Generate
  Activation"/"Regenerate" actions). Without it, generation fails
  gracefully — an `AIProviderError` is thrown and caught before anything is
  persisted (no `Activation` row at all for a failed generation; a `FAILED`
  `AccountInsight` row for research), never a crash.
- `RESEARCH_PROVIDER` — which `ResearchProvider` implementation to use
  (`"unconfigured"` default, or `"tavily"`). Selects, it never gets read
  anywhere except `lib/research-provider/factory.ts`.
- `TAVILY_API_KEY` — only used when `RESEARCH_PROVIDER=tavily`. Without it
  (even with the provider selected), external retrieval fails gracefully —
  recorded as a `NOT_CONFIGURED` error on that run's `ResearchRun.errors`,
  never a crash; the AI research/why-now steps still run on whatever signals
  already exist.

Never commit `.env`. It's already gitignored (`.env.example` is intentionally
tracked — it has no real secrets).

## Known limitations

Phase 2 (CSV import / accounts):

- CSV duplicate detection is exact-match (case-insensitive, trimmed) on
  company name (accounts) or email (contacts) — near-duplicates like "Acme
  Inc." vs "Acme, Inc." are not fuzzy-matched.
- Importing a duplicate account creates a second row rather than offering to
  update/merge the existing one — there's no unique constraint on
  `companyName`, by design, since two legitimately different companies can
  share a name.
- No pagination on the accounts list yet — fine at demo scale, worth adding
  before real data volume.
- Contact CSV import will not create a new account on your behalf; the target
  account must already exist.

Phase 3 (scoring engine):

- Score recomputation is wired into account/contact create/edit/delete and
  CSV import, plus a manual "Recalculate Score" button — it is **not**
  triggered by signal creation, because there's no signal-management UI yet
  (signals are currently seed/future-agent-created only). Once Phase 4/5 adds
  signal ingestion, that path should also trigger a recompute.
- Buying Persona scoring ignores the `Contact.influenceScore` field
  (user-entered, not "configured") — it's a manually-entered number, not
  configuration, so the dimension currently keys only on the matched
  persona's `seniorityTier`. A future phase could blend `influenceScore` in
  as a tiebreaker.
- Engagement's outcome-based path has no UI yet to create `Activity`/`Outcome`
  rows (that's Phase 6 — "activities, outcomes, feedback loop") — today those
  rows can only exist via direct seeding, so most accounts will show 0
  engagement unless they have a real ENGAGEMENT-category signal.

Phase 4 (research & GTM intelligence):

- The Research Agent itself still has no live web access — it only
  synthesizes signals/contacts already in the database. (Phase 4.5 adds a
  separate stage that *can* bring in external documents and turn them into
  new signals *before* this step runs — see **External signal ingestion**.)
  An account with no signals will legitimately get an all-`UNKNOWN` research
  result; that's correct behavior, not a bug.
- Running "Research Account" always re-runs both steps (research, then
  why-now) — there's no way to refresh only one without the other.
- The pipeline runs synchronously inside the server action (can take several
  seconds — two sequential model calls). It's built as a plain function
  precisely so a queue/background worker can wrap it later without changing
  its signature, but that wrapping doesn't exist yet.
- `Source` deduplication is exact-match on URL (or on name when there's no
  URL) — the same source cited with a slightly different name string across
  two research runs will create two `Source` rows.
- No UI yet to browse `Source`/`Evidence` independently of an account's
  Evidence card — there's no cross-account evidence or source-management view.

Phase 4.5 (external signal & research ingestion):

- A real `ResearchProvider` (Tavily) now exists as of Phase 4.75 — see below
  — but `RESEARCH_PROVIDER` still defaults to `"unconfigured"`, and no
  `TAVILY_API_KEY` is set in this repo's `.env`, so out of the box external
  retrieval still fails gracefully rather than doing anything.
- Fact extraction re-runs on an already-seen `Source` every time research is
  refreshed — only the resulting *signal* is deduplicated (by design, per the
  spec), so re-processing the same source creates new (duplicate-content)
  `Fact` rows and an extra AI call each run. Worth adding fact-level
  freshness/dedup later if this becomes wasteful in practice.
- `Signal.status` is set once at creation (`ACTIVE`) and never automatically
  transitions to `EXPIRED` on a schedule — true freshness is computed
  dynamically by the Phase 3 decay engine wherever it matters (scoring, What
  Changed). A background job that periodically flips stale signals' stored
  status is a reasonable future addition but isn't built.
- Signal detection keywords (`config/meridian/signalDetection.ts`) are a starting
  set, not exhaustive — a real fact describing a relevant event in unexpected
  phrasing may simply not match any rule and produce no signal. This is a
  content/config-coverage gap, not a bug in the matching logic itself.
- "What Changed" only reports signals that became fully expired between two
  runs, not signals whose effective (decayed) strength dropped meaningfully
  without crossing that line — a coarser "reduced" bucket could be added
  later using the same decay math.
- The Signals page has no pagination (capped at 200 rows) — fine at demo
  scale, worth revisiting before real data volume.

Phase 4.75 (production research provider + operations):

- Only one real vendor is implemented (Tavily). Its actual live behavior
  (real response shapes, real rate limits) has not been verified against a
  live API key in this environment — none is configured. The implementation
  follows Tavily's documented REST contract and is fully unit-tested against
  a mocked `fetch`, but "tested against the real service" and "tested against
  a faithful mock" are not the same claim.
- The freshness cache is per-account, single-tier (fresh / not fresh) — there
  is no way to configure a different window per account, industry, or signal
  category (only `RESEARCH_FRESHNESS_WINDOW_HOURS`, one global default,
  overridable per-call for tests).
- `maxSearchesPerRun` is defined but not actively enforced as a hard multi-
  query budget, since the current provider issues exactly one query per run —
  it's a real config value ready for a future multi-query provider, not yet a
  guard rail anything can violate today.
- Source-quality classification is a small, hand-curated domain allowlist
  (`config/meridian/sourceQuality.ts`) — a legitimate maritime trade publication
  not on that list is classified `SECONDARY`/`UNKNOWN` even though it may be
  quite authoritative. Expanding the list is a config change, not a code
  change.
- The retry logic retries transient failures with no backoff delay between
  attempts — fine at today's volume, but a real backoff (exponential or
  jittered) would be worth adding before higher-volume production use.

Phase 5 (human-approved GTM activation):

- **No external sending integration exists, by design** — `markActivationSent`
  is a plain database write with no network dependency at all. There is no
  LinkedIn API, no email delivery, no webhook — a human still has to actually
  send the approved content through whatever tool they normally use, and then
  come back and mark it sent for record-keeping.
- `approvedBy`/`createdBy` are free-text/optional string fields, not tied to a
  real authentication/user system — this app has no login, so "who approved
  this" is attributed on a best-effort basis (the review UI passes a fixed
  approver identity), not cryptographically or session-verified.
- Regeneration always re-runs the full context-gathering + AI call — there's
  no "regenerate with a tweak to just the CTA" partial-regeneration path; it's
  a brand-new draft from the same underlying intelligence each time.
- The evidence grounding check only verifies that a cited id exists *for this
  account* — it does not check that the cited evidence is actually relevant
  to the specific sentence it's attached to; a model could still cite a real
  but weakly-related evidence id. Catching that requires a human reviewer,
  which is exactly what this phase's approval step is for.
- `SALES_BRIEF`/`CONTENT_RECOMMENDATION` activations don't require a contact,
  but the review page's "WHO" section will legitimately show "no specific
  contact" for these — that's correct behavior for internal-facing channels,
  not a missing feature.
- There's no bulk action on the `/activations` dashboard (e.g. approve
  several at once) — every approval is a single, individually-reviewed
  action, which is intentional given the phase's human-in-the-loop principle,
  but could become a throughput bottleneck at higher volume.
- The Activation Agent's live behavior against the real Claude API has not
  been separately smoke-tested with a live key in this environment during
  this phase's build — the full test suite and a full manual workflow
  smoke-test (generate → edit → submit → regenerate → approve → mark sent →
  cleanup) were run with an injected fake `AIClient` to avoid live model
  spend; "tested against a faithful mock" and "verified against the live
  service" are not the same claim, exactly as noted for the Tavily provider
  in Phase 4.75.

Phase 6 (outcomes, attribution & GTM feedback):

- **Outcome capture is entirely manual, by design** — there is no email/
  LinkedIn tracking pixel, webhook, or CRM sync feeding `OutcomeEvent` rows
  automatically. `source` is always `"manual"` today; the field exists so a
  future integration has somewhere to report from without a schema change,
  but no such integration is built.
- Persona/product filtering on `/outcomes` and the persona/signal-type/
  product analytics dimensions all read each activation's frozen
  `contextSnapshot` in application code (not a database-level JSON query) —
  fine at this app's demo scale, but would need a different approach (e.g. a
  denormalized join table) before real data volume.
- Pre-Phase-6 `Activation` rows (generated before this migration) have
  `contextSnapshot: null` and `angle`/`cta: null` — every read path handles
  this gracefully (they simply contribute nothing to the journey/analytics),
  but there is no backfill migration that reconstructs a snapshot for them
  retroactively, since doing so would violate the phase's own "never
  reconstruct historical context from current records" principle.
- The GTM Journey's "recalculated as part of a research run" annotation on a
  score entry is a best-effort, narrowly-scoped correlation (exact score
  match within a 5-second window of a `ResearchRun`'s completion) — a score
  recomputed for another reason (e.g. the manual "Recalculate Score" button)
  at almost the same moment as an unrelated research run could, in principle,
  be mislabeled. This is a narrow edge case, not a systemic issue, and no
  score entry is ever labeled with a fabricated cause when no such match
  exists — it's simply left unannotated.
- Analytics rates (reply rate, positive-reply rate, meeting rate) are computed
  per sent activation and are **not** capped at 100% — an activation can
  receive more than one reply-type event, which is a real, factual outcome
  and intentionally not clamped into a false "one activation = one outcome"
  model.
- There is no UI to delete or amend a mis-recorded `OutcomeEvent` — the model
  is append-only by design, so correcting a mistake today means recording a
  new, correcting event (e.g. a manual note) rather than editing history.
- No automatic learning loop exists, and none is planned as an automatic
  system per the spec — `/analytics` is read-only input for a human to decide
  whether/how to adjust scoring, ICP rules, or messaging; nothing in this
  codebase writes back to `ScoringRule`, `ICPRule`, `config/meridian/*`, or any AI
  prompt based on outcome data.
