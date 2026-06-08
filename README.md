# ContractScan

Upload a vendor contract, get back a plain-English breakdown of the clauses that could hurt you — and see which of your vendors carry the most risk overall.

---

## The problem

Companies sign a lot of contracts: SaaS subscriptions, NDAs, MSAs, statements of work. The clauses that matter — auto-renewals with a tiny cancellation window, liability capped at one month's fees, the vendor's right to raise prices whenever they like — are buried in pages of legal text nobody reads until it's too late.

ContractScan reads the contract for you. You upload a PDF, and it pulls out the risky clauses, explains each one in a sentence or two, rates how serious it is, and suggests what to do. Do that across all of a vendor's contracts and you get a picture of which vendor relationships are the most exposed.

---

## What it does

- Sign up, log in — each account only ever sees its own data
- Add vendors and the contracts that belong to them
- Upload contract PDFs; the text gets extracted and analyzed
- See every flagged clause with a severity (high / medium / low), a short summary, the original text, and a recommendation
- A dashboard that ranks all your vendors by how much risk their contracts add up to

---

## How it's built

### Backend — FastAPI (Python)

The slowest thing this app does is wait on an LLM API, so async matters — FastAPI handles that cleanly without extra machinery. It also gives you request/response validation through Pydantic and auto-generated API docs for free. Flask would need add-ons for both; Django is more than a project this size needs.

### Frontend — React + TypeScript + Vite

A dashboard is a good fit for React, and TypeScript catches mismatches between what the backend sends and what the frontend expects before they become runtime bugs. Vite keeps the dev server fast. No Next.js — there's no need for server-side rendering here.

### Styling — Tailwind + shadcn/ui

All the colors, fonts, and spacing live as tokens in `tailwind.config.ts`. Change the palette there and the whole app follows, because components reference names like `primary` and `risk-high`, never raw values like `blue-500`. shadcn/ui gives accessible components that don't fight Tailwind.

### Database & storage — Supabase (PostgreSQL)

Supabase is managed Postgres plus file storage plus auth, all on a free tier that's plenty for this. The big win is Row Level Security: access rules live in the database itself, scoped to the logged-in user. Even if the application code had a bug, the database still won't hand one user another user's rows.

### Auth — Supabase Auth + JWT

Supabase handles registration, login, and password hashing — the app never stores a password. On login the frontend gets a JWT and sends it with every request; the backend checks it on every protected endpoint and pulls the user's ID from the verified token, never from the request body.

### File storage

PDFs go into a private Supabase bucket under `{user_id}/{uuid}.pdf`. The original filename is kept in the database for display only — it never touches the storage path, which avoids name collisions and stops anyone from guessing file locations.

### The AI part — pluggable LLM provider

This is the piece that changed most recently, so it's worth explaining.

The analyzer doesn't talk to any specific AI vendor. It talks to a small interface — `LLMProvider` — with one method: `generate(prompt)`. Two implementations exist:

- **Anthropic** (`claude-haiku-4-5`) — the default
- **OpenAI** (`gpt-4o-mini`)

Which one runs is decided by a single environment variable, `LLM_PROVIDER`. Set it to `anthropic` or `openai`, drop in the matching API key, and that's it — no code changes. A factory reads the variable and hands back the right provider; the analysis code never imports a vendor SDK directly. If you want to add a third provider later, you write one class and the rest of the app doesn't notice.

Haiku is the default because the job is fast, structured extraction rather than deep reasoning — it's quick, cheap, and good enough for reading clauses.

On startup the server logs which provider is active (or whether it's running in mock mode), so you always know what to expect from the logs.

---

## How the analysis works (two passes)

The obvious approach is to throw the whole contract at the model and say "find the risky clauses and explain them." That holds up on short contracts and falls apart on long ones — the model starts missing clauses, mixing separate issues together, and returning messy output when it's asked to do too much at once.

So it's split into two steps:

**Pass 1 — find the clauses.** Send the full contract. Ask only for the clauses that fall into the risk categories below, returned as a JSON list of `{ clause_type, original_text }`. The model is doing one thing: locating and labeling text.

**Pass 2 — judge each clause.** Take each clause from pass 1 on its own and ask for a severity, a plain-English summary, and a recommendation. Again, one job: reasoning about one piece of text.

Why bother:

- Smaller, focused prompts give more reliable, better-structured output
- If a clause gets missed, you know it's the extraction prompt that needs work, not the reasoning prompt
- The pass-2 calls all run at once (async), so the total wait is pass 1 plus the slowest single clause — not pass 1 plus every clause added together
- One bad clause doesn't sink the run: if pass 2 fails on a clause, it's logged and skipped, and the rest still come through

The categories pass 1 looks for:

- Auto-renewals, especially with short cancellation windows
- Liability caps that are one-sided or unreasonably low
- Who owns the data
- The vendor's right to change pricing on their own
- SLA promises with no penalty if they're broken
- Termination-for-convenience that only one side gets
- Lopsided indemnification
- Surprising governing-law or jurisdiction clauses

There's also a mock mode (`USE_MOCK_GEMINI=true`) that returns a fixed set of sample clauses without calling any API — handy for working on the rest of the pipeline without burning quota. (The name is a leftover from when this used Gemini.)

---

## A couple of safety details on the text

PDF text is messy. Before any extracted text gets stored, two things happen in `pdf_extractor.py`:

- **Null bytes are removed.** Postgres `text` columns reject `\x00` outright, so this would otherwise crash the insert.
- **Other non-printable control characters are stripped** (keeping tabs, newlines, and carriage returns, which carry real layout).

If a PDF turns out to be a scanned image with no extractable text, that's caught and the contract is marked `failed` instead of crashing the run.

---

## Architecture

```
Browser
   |  HTTPS
React frontend (Vercel)
   |  REST + JWT
FastAPI backend (Railway)
   |                    |
Supabase Postgres   Supabase Storage
(RLS per user)      (private bucket)
   |
LLM API
(Anthropic or OpenAI, chosen by LLM_PROVIDER)
```

Frontend and backend deploy separately so either can be changed or scaled on its own. The backend treats the frontend as untrusted: every request is authenticated and every query is scoped to the user who made it.

---

## Data model

### Users
Handled by Supabase Auth. The app references users by `user_id` (UUID) and stores no passwords or auth secrets of its own.

### Vendors
```
id           UUID, primary key
user_id      UUID  -> auth.users (indexed)
name         TEXT, required
website      TEXT
category     TEXT  (SaaS / Legal / Infrastructure / Finance / Other)
created_at   TIMESTAMPTZ
```
RLS policy: `user_id = auth.uid()`.

### Contracts
```
id             UUID, primary key
vendor_id      UUID  -> vendors
user_id        UUID  -> auth.users
filename       TEXT  (original name, display only)
storage_path   TEXT  (UUID-based path in storage)
contract_type  TEXT  (NDA / MSA / SaaS Agreement / SOW / Other)
status         pending | analyzing | done | failed
raw_text       TEXT  (extracted PDF text, never sent to the frontend)
uploaded_at    TIMESTAMPTZ
analyzed_at    TIMESTAMPTZ
```
`user_id` is duplicated onto contracts (instead of looking it up through the vendor) so the RLS check is a single column comparison with no join.

### ClauseRisks
```
id              UUID, primary key
contract_id     UUID  -> contracts
user_id         UUID  -> auth.users
clause_type     TEXT  (auto_renewal / liability_cap / data_ownership / ...)
severity        high | medium | low
summary         TEXT  (plain English, 1-2 sentences)
original_text   TEXT  (verbatim from the contract)
recommendation  TEXT  (what to do about it)
created_at      TIMESTAMPTZ
```

---

## Security notes

- **Row Level Security** on every table, scoped to `auth.uid()` — the database is the last line of defense, not just the app.
- **UUID storage paths** (`{user_id}/{uuid}.pdf`) so files can't be guessed or enumerated.
- **JWT checked on every protected endpoint**, with the user ID taken from the verified token.
- **`raw_text` never leaves the backend** — the frontend only ever gets the structured clause data.
- **Secrets come from environment variables only.** Backend: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `LLM_PROVIDER`, and whichever of `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` matches the active provider. Frontend: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the anon key is safe to expose — it's rate-limited and gated by RLS).
- **CORS is an explicit allow-list**, never `*`.

---

## Patterns worth pointing out

Three patterns earn their place here because they make the code simpler, not because patterns are nice to have:

- **Repository** — all database queries live in `*_repository.py` classes. Route handlers call methods, not raw SQL, so a schema change touches one file.
- **Service layer** — the real work (PDF extraction, LLM calls, risk scoring) lives in services. Route handlers just validate input, call a service, and return the result.
- **Strategy** — the `LLMProvider` interface described above. The whole point is that swapping the AI backend is a config change, and the rest of the code never has to know which provider it's talking to.

---

## Design tokens

Everything visual is defined once, in `tailwind.config.ts`:

```
primary        main brand color (buttons, active states)
surface        card / panel backgrounds
background     page background
border         borders
text-primary   body text
text-muted     labels, captions, secondary text
risk-high      red    (high severity)
risk-medium    amber  (medium severity)
risk-low       green  (low severity)
```

Change a value here and the whole app updates. Fonts work the same way (`font-display`, `font-body`).

---

## Project layout

```
contractscan/
├── backend/
│   ├── app/
│   │   ├── main.py                  FastAPI app, CORS, startup log, routers
│   │   ├── config.py                env settings (pydantic-settings)
│   │   ├── dependencies.py          auth, get_current_user
│   │   ├── database.py              Supabase client
│   │   ├── routers/
│   │   │   ├── auth.py              login, register, logout
│   │   │   ├── vendors.py          vendor CRUD
│   │   │   ├── contracts.py        upload, list, delete
│   │   │   ├── analysis.py         trigger analysis, fetch results
│   │   │   └── dashboard.py        portfolio overview
│   │   ├── repositories/
│   │   │   ├── vendor_repository.py
│   │   │   ├── contract_repository.py
│   │   │   └── clause_risk_repository.py
│   │   ├── services/
│   │   │   ├── pdf_extractor.py     pdfplumber extraction + text cleanup
│   │   │   ├── llm_analyzer.py      the two-pass analysis (provider-agnostic)
│   │   │   ├── risk_aggregator.py   portfolio-level risk scoring
│   │   │   └── llm/
│   │   │       ├── base.py          LLMProvider interface
│   │   │       ├── factory.py       picks the provider from LLM_PROVIDER
│   │   │       ├── anthropic_provider.py
│   │   │       └── openai_provider.py
│   │   └── schemas/
│   │       ├── auth.py
│   │       ├── vendor.py
│   │       ├── contract.py
│   │       ├── clause_risk.py
│   │       └── dashboard.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                  routing
│   │   ├── lib/
│   │   │   ├── supabase.ts
│   │   │   ├── api.ts               axios instance with auth header
│   │   │   └── utils.ts
│   │   ├── hooks/
│   │   │   ├── useAuth.tsx
│   │   │   ├── useVendors.ts
│   │   │   ├── useVendorRisk.ts
│   │   │   ├── useContracts.ts
│   │   │   └── useDashboard.ts
│   │   ├── components/
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── layout/
│   │   │   ├── vendors/
│   │   │   ├── contracts/
│   │   │   ├── analysis/            RiskBadge, ClauseCard, summary bar
│   │   │   └── ui/                  shadcn components
│   │   └── pages/
│   │       ├── LoginPage.tsx
│   │       ├── RegisterPage.tsx
│   │       ├── DashboardPage.tsx    all vendors ranked by risk
│   │       └── VendorDetailPage.tsx contracts + clauses for one vendor
│   ├── tailwind.config.ts           design tokens
│   ├── index.html
│   └── .env.example
└── README.md
```

---

## Running it locally

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in your keys (see below)
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
cp .env.example .env          # fill in your Supabase keys
npm run dev
```

For the backend `.env`, set `LLM_PROVIDER` to `anthropic` or `openai` and provide the matching key (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`). Set `USE_MOCK_GEMINI=true` if you want to run the pipeline without calling any AI API.

---

## Deployment

The intended setup:

- **Backend → Railway** — connect the repo, set the environment variables, deploy. Roughly $5/month.
- **Frontend → Vercel** — connect the repo, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, deploy. Free tier is fine.
- **Database + storage → Supabase** — the free tier (500 MB database, 1 GB storage) covers this comfortably.

---

## Test contracts

Real contracts to test against, from public sources:

- **SEC EDGAR** — public companies attach real vendor and SaaS agreements as exhibits to their filings. Look for Exhibit 10 attachments on 10-K or 8-K filings. These were actually signed by real companies, which makes them a solid test set.
- **CommonPaper** — open-source standard agreements (cloud service agreements, NDAs).
- **Contract Standards** — annotated sample contracts across categories.
```
