# ContractScan

**AI-powered vendor contract risk analyzer.** Upload vendor contracts, get plain-English risk breakdowns, and manage your legal exposure across your entire vendor portfolio — all in one place.

---

## What This Is

Most companies sign dozens of SaaS agreements, NDAs, and vendor contracts every year. The details — auto-renewal clauses, data ownership terms, asymmetric liability caps — get buried in legal boilerplate that nobody reads until something goes wrong.

ContractScan fixes that. You upload a contract PDF, and the system extracts every clause that could bite you, explains what it means in plain English, assigns it a risk severity, and tells you what to do about it. Across multiple contracts per vendor, it builds a risk profile so you can see which vendor relationships carry the most legal exposure.

It is built to be demoed, extended, and understood. Every technical decision in this document has a reason.

---

## Feature Overview

- Multi-user authentication with secure session management
- Per-user data isolation — users only ever see their own vendors and contracts
- Vendor management with risk scoring derived from their contracts
- PDF upload and text extraction for text-based contracts
- Two-pass AI analysis: clause identification followed by risk reasoning
- Risk dashboard per vendor showing all flagged clauses with severity, plain-English summary, original text, and recommendation
- Portfolio overview ranking all vendors by aggregate risk
- Secure file storage with UUID-based paths and no exposed filenames

---

## Tech Stack

### Backend — FastAPI (Python)

FastAPI was chosen over Flask or Django for three reasons: native async support (important for non-blocking Gemini API calls during PDF analysis), automatic OpenAPI documentation generation, and first-class Pydantic integration for request/response validation. For a project where the heaviest operation is waiting on an external AI API, async matters.

### Frontend — React + TypeScript + Vite

React with TypeScript is the right default for a dashboard application. TypeScript catches contract mismatches between the frontend and backend early, and Vite's dev server is significantly faster than Create React App for iteration. No Next.js — server-side rendering adds complexity that a single-user dashboard does not need.

### Styling — Tailwind CSS + shadcn/ui

Tailwind solves the "change the color palette without touching 100 files" problem directly. The entire visual theme lives in `tailwind.config.ts` as CSS custom properties. Swap the primary color there and the entire application updates. shadcn/ui provides accessible, unstyled-by-default components that work with Tailwind without fighting it. This combination produces professional UI without a design system from scratch.

### Database — PostgreSQL via Supabase

Supabase provides managed PostgreSQL with three features that matter here: Row Level Security (RLS) for enforcing per-user data isolation at the database level, built-in storage for contract PDFs, and a generous free tier. RLS means that even if application-level auth has a bug, the database itself refuses to return another user's data. That is defense in depth.

### Authentication — Supabase Auth + JWT

Supabase Auth handles user registration, login, and session management. It issues JWTs that the frontend sends on every request. The backend validates these tokens against Supabase's public keys on every protected endpoint. Passwords are never stored in the application — Supabase handles hashing (bcrypt) and salting. Refresh tokens are handled automatically by the Supabase client SDK on the frontend.

### File Storage — Supabase Storage

Contract PDFs are stored in a private Supabase Storage bucket. Files are saved under `{user_id}/{uuid}.pdf` — never the original filename, which could leak information or cause collisions. Supabase Storage enforces bucket-level policies so users can only access their own files. Signed URLs with short expiry are used for any file retrieval.

### AI Analysis — Google Gemini API (gemini-1.5-flash)

Gemini handles both passes of contract analysis. gemini-1.5-flash is the right model here: capable enough for nuanced legal clause interpretation, fast enough for interactive use, and free within generous daily limits (1,500 requests/day) with pay-as-you-go beyond that. Extended thinking is not needed — the task is structured extraction, not open-ended reasoning.

---

## Architecture

```
User (browser)
    ↓ HTTPS
React Frontend (Vercel)
    ↓ REST API calls with JWT
FastAPI Backend (Railway)
    ↓                    ↓
Supabase DB         Supabase Storage
(PostgreSQL + RLS)  (Private bucket)
    ↓
Gemini API
(Google)
```

The frontend and backend are deployed separately. This is standard practice — it lets you scale, redeploy, or swap either layer independently. The backend never trusts the frontend: every request is authenticated, every database query is scoped to the requesting user's ID.

---

## Data Model

### Users
Managed entirely by Supabase Auth. The application references `auth.users` by `user_id` (UUID) but never stores passwords or sensitive auth data in application tables.

### Vendors
```
id            UUID, primary key
user_id       UUID, foreign key → auth.users (indexed)
name          TEXT, not null
website       TEXT
category      TEXT (SaaS / Legal / Infrastructure / Finance / Other)
created_at    TIMESTAMPTZ, default now()
```
Every vendor belongs to a user. RLS policy: `user_id = auth.uid()`.

### Contracts
```
id              UUID, primary key
vendor_id       UUID, foreign key → vendors
user_id         UUID, foreign key → auth.users (denormalized for RLS simplicity)
filename        TEXT (original filename, display only)
storage_path    TEXT (UUID-based path in Supabase Storage)
contract_type   TEXT (NDA / MSA / SaaS Agreement / SOW / Other)
status          ENUM: pending | analyzing | done | failed
raw_text        TEXT (extracted from PDF, not exposed to frontend)
uploaded_at     TIMESTAMPTZ
analyzed_at     TIMESTAMPTZ
```
`user_id` is denormalized onto contracts (even though it could be derived via vendor) so RLS policies stay simple and fast — one column check per row, no joins in policy evaluation.

### ClauseRisks
```
id               UUID, primary key
contract_id      UUID, foreign key → contracts
user_id          UUID, foreign key → auth.users (same reason as above)
clause_type      TEXT (auto_renewal / liability_cap / data_ownership / etc.)
severity         ENUM: high | medium | low
summary          TEXT (plain English, 1–2 sentences)
original_text    TEXT (verbatim from contract)
recommendation   TEXT (what to do about it)
created_at       TIMESTAMPTZ
```

---

## The Two-Pass AI Analysis

This is the most important technical decision in the project and worth understanding clearly.

A naive approach would send the entire contract to Gemini and ask it to "find all risky clauses and assess them." This works on short contracts but degrades on longer ones — the model starts to miss clauses, conflate separate issues, or produce inconsistently structured output when asked to do too much at once.

The two-pass approach separates concerns:

**Pass 1 — Extraction:** Send the full contract text. Ask Gemini to identify and extract verbatim text for any clause that falls into the defined risk categories. The only output is a JSON array of `{ clause_type, original_text }`. Gemini is doing one thing: finding and labeling text.

**Pass 2 — Reasoning:** For each extracted clause, send just that clause in isolation. Ask Gemini to assess severity, write a plain-English summary, and provide a recommendation. Gemini is doing one thing: reasoning about a specific piece of text.

Why this works better:
- Smaller, focused prompts produce more reliable structured outputs
- If Pass 1 misses a clause, you know the extraction prompt needs work, not the reasoning prompt
- Pass 2 runs in parallel across all extracted clauses (async), so total latency is roughly: Pass 1 time + slowest single clause time, not Pass 1 + sum of all clauses
- Failures are isolated — a bad PDF extraction fails at Pass 1, not partway through analysis

The risk categories flagged in Pass 1:
- Auto-renewal traps (especially short notice windows)
- Liability caps (asymmetric or unreasonably low)
- Data ownership and data sharing rights
- Unilateral price change rights
- SLA commitments with no financial penalty
- Termination for convenience (who has it, who doesn't)
- Indemnification asymmetry
- Governing law and jurisdiction surprises

---

## Security Decisions

**Row Level Security (RLS):** Every table has RLS enabled with policies that scope all operations to `auth.uid()`. This is database-level enforcement — application bugs cannot leak cross-user data.

**UUID storage paths:** Contract files are stored as `{user_id}/{uuid4()}.pdf`. The original filename is stored in the database for display but never used in the storage path. This prevents enumeration attacks and path traversal.

**JWT validation on every request:** The FastAPI backend validates the Supabase JWT on every protected endpoint. The user's ID is extracted from the validated token, never from the request body or query params.

**No raw_text in API responses:** The extracted PDF text is stored in the database for analysis but never returned to the frontend. The frontend only receives structured clause data.

**Environment variables only:** No secrets in code. The backend reads `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `GEMINI_API_KEY` from environment variables. The frontend reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — the anon key is safe to expose, it is rate-limited and scoped by RLS.

**CORS locked down:** The FastAPI CORS configuration explicitly lists allowed origins. Not `*`.

---

## Design System

The UI uses a single source of truth for all visual decisions: `tailwind.config.ts`. The color palette is defined there as semantic tokens:

```
primary       — main brand color, used for CTAs and active states
surface       — card and panel backgrounds
background    — page background
border        — all border colors
text-primary  — main body text
text-muted    — secondary text, labels, captions
risk-high     — red, used for high severity badges
risk-medium   — amber, used for medium severity badges
risk-low      — green, used for low severity badges
```

To change the entire application's color palette: edit these values in `tailwind.config.ts`. Nothing else changes. Components reference semantic tokens, never raw color values like `blue-500`.

Typography follows the same principle — font families are defined in `tailwind.config.ts` and referenced as `font-display` and `font-body` throughout.

---

## Design Patterns Used

Two patterns are used here because they genuinely simplify the code, not because patterns are good in themselves.

**Repository Pattern (backend):** Database queries are isolated in repository classes (`VendorRepository`, `ContractRepository`, `ClauseRiskRepository`). Route handlers call repository methods, not raw SQL. This means if the database changes, only repository files change — not route handlers. It also makes the query logic testable in isolation.

**Service Layer (backend):** Business logic — PDF extraction, Gemini API calls, risk aggregation — lives in service classes, not route handlers. Route handlers do three things: validate input, call a service, return a response. Services do the work. This separation means the Gemini analysis logic can be tested or swapped without touching the API layer.

These patterns are called out explicitly because they reflect real engineering judgment — using structure where it adds clarity, not everywhere by default.

---

## Project Structure

```
contractscan/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app, CORS, router registration
│   │   ├── config.py                # Environment variable loading (pydantic-settings)
│   │   ├── dependencies.py          # Auth middleware, get_current_user
│   │   ├── database.py              # Supabase client initialization
│   │   ├── routers/
│   │   │   ├── auth.py              # Login, register, logout
│   │   │   ├── vendors.py           # CRUD for vendors
│   │   │   ├── contracts.py         # Upload, list, delete contracts
│   │   │   └── analysis.py          # Trigger analysis, get results
│   │   ├── repositories/
│   │   │   ├── vendor_repository.py
│   │   │   ├── contract_repository.py
│   │   │   └── clause_risk_repository.py
│   │   ├── services/
│   │   │   ├── pdf_extractor.py     # pdfplumber text extraction
│   │   │   ├── gemini_analyzer.py   # Two-pass Gemini analysis
│   │   │   └── risk_aggregator.py   # Portfolio-level risk scoring
│   │   └── schemas/
│   │       ├── vendor.py
│   │       ├── contract.py
│   │       └── clause_risk.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                  # Router setup
│   │   ├── lib/
│   │   │   ├── supabase.ts          # Supabase client
│   │   │   └── api.ts               # Axios instance with auth headers
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useVendors.ts
│   │   │   └── useContracts.ts
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── TopBar.tsx
│   │   │   ├── vendors/
│   │   │   │   ├── VendorCard.tsx
│   │   │   │   └── VendorForm.tsx
│   │   │   ├── contracts/
│   │   │   │   ├── ContractUpload.tsx
│   │   │   │   └── ContractList.tsx
│   │   │   └── analysis/
│   │   │       ├── RiskBadge.tsx
│   │   │       ├── ClauseCard.tsx
│   │   │       └── RiskSummaryBar.tsx
│   │   └── pages/
│   │       ├── LoginPage.tsx
│   │       ├── RegisterPage.tsx
│   │       ├── DashboardPage.tsx    # Portfolio overview, all vendors ranked by risk
│   │       └── VendorDetailPage.tsx # All contracts + clauses for one vendor
│   ├── tailwind.config.ts           # Single source of truth for design tokens
│   ├── index.html
│   └── .env.example
└── README.md
```

---

## Development Workflow

Features are built and committed one at a time in this order:

1. Project scaffolding and environment setup
2. Supabase schema, RLS policies, and storage bucket
3. Authentication (register, login, logout, protected routes)
4. Vendor CRUD (create, list, edit, delete)
5. Contract upload (PDF storage, metadata saved, status: pending)
6. PDF extraction and Gemini two-pass analysis pipeline
7. Risk dashboard — vendor detail page with clause cards
8. Portfolio overview — all vendors ranked by risk score
9. UI polish, loading states, error handling
10. Deployment (Railway + Vercel)

Each feature is committed to GitHub before the next begins. This keeps the git history readable and makes it easy to demo any intermediate state of the project.

---

## Deployment

**Backend → Railway**
Connect the GitHub repo, set environment variables in the Railway dashboard, deploy. Railway detects the Python project and runs it automatically. Estimated cost: ~$5/month.

**Frontend → Vercel**
Connect the GitHub repo, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel environment variables, deploy. Free tier is sufficient.

**Database + Storage → Supabase**
Free tier covers this project comfortably: 500MB database, 1GB storage, 50MB file upload limit per file.

**Total estimated monthly cost: ~$5**

---

## Running Locally

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in your keys
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
cp .env.example .env  # fill in your Supabase keys
npm run dev
```

---

## Test Data

Contracts for testing come from public sources:

- **SEC EDGAR** (https://www.sec.gov/cgi-bin/browse-edgar) — public companies file real vendor agreements, SaaS contracts, and partnership agreements as exhibits. Search for "10-K" or "8-K" filings and look for Exhibit 10 attachments.
- **CommonPaper** (https://commonpaper.com) — open-source standard contracts including Cloud Service Agreements and NDAs.
- **Contract Standards** (https://www.contractstandards.com) — annotated sample contracts across many categories.

These are real, varied, legally complex contracts. Testing against SEC EDGAR filings specifically means testing against contracts that were actually signed by real companies — a meaningful quality bar.

---

## What This Project Demonstrates

For anyone evaluating this project technically:

- Agentic AI pipeline design (multi-pass extraction, structured JSON output, parallel async execution)
- LLM prompt engineering for reliable structured output from unstructured legal text
- Security-first architecture (RLS, JWT validation, UUID storage paths, no secrets in code)
- Clean separation of concerns (repository pattern, service layer, thin route handlers)
- Design system thinking (semantic tokens, single config file controls entire palette)
- Full-stack TypeScript/Python integration with proper type safety end-to-end
- Real deployment with cost-conscious infrastructure choices
