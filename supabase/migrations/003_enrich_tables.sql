-- Run in Supabase Dashboard → SQL Editor

-- Add enrichment columns to watches
alter table watches
  add column if not exists has_box boolean,
  add column if not exists has_papers boolean,
  add column if not exists has_service_history boolean,
  add column if not exists condition_score integer,
  add column if not exists market_avg_price numeric;

-- Allow anon to update watches (enrichment script writes back)
create policy "Allow anon updates"
  on watches for update
  to anon
  using (true)
  with check (true);

-- Market price aggregates per reference
create table if not exists price_analysis (
  reference_number text not null,
  brand            text not null,
  model            text,
  avg_price        numeric,
  min_price        numeric,
  max_price        numeric,
  listing_count    integer,
  last_updated     timestamptz default now(),
  primary key (reference_number, brand)
);

alter table price_analysis enable row level security;
create policy "Allow public reads" on price_analysis for select to anon, authenticated using (true);
create policy "Allow anon inserts" on price_analysis for insert to anon with check (true);
create policy "Allow anon updates" on price_analysis for update to anon using (true);

-- Alert subscribers
create table if not exists subscribers (
  id               bigint generated always as identity primary key,
  email            text not null,
  brand            text,
  reference_number text,
  max_price        numeric,
  must_have_papers boolean default false,
  created_at       timestamptz default now()
);

alter table subscribers enable row level security;
create policy "Allow anon inserts" on subscribers for insert to anon with check (true);
create policy "Allow anon reads"   on subscribers for select to anon using (true);
