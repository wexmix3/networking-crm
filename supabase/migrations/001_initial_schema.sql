-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Contacts
create table if not exists crm_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  company text,
  role text,
  linkedin_url text,
  email text,
  phone text,
  source text,
  tags text[] default '{}',
  notes text,
  created_at timestamptz default now() not null
);

alter table crm_contacts enable row level security;

create policy "Users manage own contacts"
  on crm_contacts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Interactions
create table if not exists crm_interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references crm_contacts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('met','emailed','called','dm','other')),
  note text,
  interaction_date date not null default current_date,
  created_at timestamptz default now() not null
);

alter table crm_interactions enable row level security;

create policy "Users manage own interactions"
  on crm_interactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Digest preferences
create table if not exists crm_digest_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  email text not null,
  digest_enabled boolean default true not null,
  digest_day integer default 1 not null check (digest_day between 0 and 6),
  stale_threshold_days integer default 30 not null,
  created_at timestamptz default now() not null
);

alter table crm_digest_preferences enable row level security;

create policy "Users manage own digest prefs"
  on crm_digest_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- View: contacts enriched with last interaction
create or replace view crm_contacts_with_staleness as
select
  c.*,
  max(i.interaction_date)::text as last_interaction_date,
  (current_date - max(i.interaction_date))::int as days_since_contact,
  count(i.id)::int as interaction_count
from crm_contacts c
left join crm_interactions i on i.contact_id = c.id
group by c.id;
