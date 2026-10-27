-- HeronScout core tables. Run with: pnpm db:migrate

create table if not exists leads (
  id bigserial primary key,
  place_id text unique,
  name text not null,
  category text,
  phone text,
  website text,
  address text,
  city text,
  country_code text,
  rating numeric(2, 1),
  review_count integer,
  maps_url text,
  image_urls jsonb not null default '[]',
  reviews jsonb not null default '[]',
  email text,
  instagram text,
  facebook text,
  -- 'ltd' | 'sole' | 'unknown'; UK outreach only goes to 'ltd'
  company_type text not null default 'unknown',
  -- new -> contacts_checked -> previewed -> queued -> contacted -> replied -> won | lost | skipped
  status text not null default 'new',
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_status_idx on leads (status);

create table if not exists previews (
  slug text primary key,
  lead_id bigint not null references leads (id) on delete cascade,
  spec jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists messages (
  id bigserial primary key,
  lead_id bigint not null references leads (id) on delete cascade,
  step integer not null,
  subject text not null,
  body text not null,
  send_at timestamptz,
  sent_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent', 'cancelled')),
  message_id text,
  created_at timestamptz not null default now()
);

create index if not exists messages_due_idx on messages (status, send_at);

-- Checked before every send. Anyone who replies "no" lands here for good.
create table if not exists suppression (
  email text primary key,
  reason text,
  created_at timestamptz not null default now()
);
