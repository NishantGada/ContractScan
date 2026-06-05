-- ContractScan database schema
-- Run this in the Supabase SQL editor (or via psql) once per project.
-- Safe to re-run: guards make it idempotent.

-- Enums
do $$ begin
  create type contract_status as enum ('pending', 'analyzing', 'done', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type risk_severity as enum ('high', 'medium', 'low');
exception when duplicate_object then null; end $$;

-- Vendors
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  website text,
  category text check (category in ('SaaS', 'Legal', 'Infrastructure', 'Finance', 'Other')),
  created_at timestamptz not null default now()
);
create index if not exists vendors_user_id_idx on vendors(user_id);
alter table vendors enable row level security;
drop policy if exists "Users can only access their own vendors" on vendors;
create policy "Users can only access their own vendors"
  on vendors for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Contracts
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  contract_type text check (contract_type in ('NDA', 'MSA', 'SaaS Agreement', 'SOW', 'Other')),
  status contract_status not null default 'pending',
  raw_text text,
  uploaded_at timestamptz not null default now(),
  analyzed_at timestamptz
);
create index if not exists contracts_vendor_id_idx on contracts(vendor_id);
create index if not exists contracts_user_id_idx on contracts(user_id);
alter table contracts enable row level security;
drop policy if exists "Users can only access their own contracts" on contracts;
create policy "Users can only access their own contracts"
  on contracts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Clause Risks
create table if not exists clause_risks (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  clause_type text not null,
  severity risk_severity not null,
  summary text not null,
  original_text text not null,
  recommendation text not null,
  created_at timestamptz not null default now()
);
create index if not exists clause_risks_contract_id_idx on clause_risks(contract_id);
create index if not exists clause_risks_user_id_idx on clause_risks(user_id);
alter table clause_risks enable row level security;
drop policy if exists "Users can only access their own clause risks" on clause_risks;
create policy "Users can only access their own clause risks"
  on clause_risks for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Privileges
-- The FastAPI backend uses the service_role key for every query (it scopes each
-- query to the JWT-derived user_id itself; RLS above is defense in depth).
-- Supabase normally auto-grants these, but grant explicitly so the schema is
-- self-contained and re-runnable.
grant usage on schema public to service_role;
grant select, insert, update, delete on vendors, contracts, clause_risks to service_role;
