-- Enable RLS and add permissive policies for the watches table.
-- The anon key is used by both the web app (reads) and the scraper (inserts).
-- Run this in the Supabase Dashboard → SQL Editor.

alter table watches enable row level security;

-- Allow public reads (web app)
create policy "Allow public reads"
  on watches for select
  to anon, authenticated
  using (true);

-- Allow inserts from anon (scraper uses the anon key)
create policy "Allow anon inserts"
  on watches for insert
  to anon
  with check (true);
