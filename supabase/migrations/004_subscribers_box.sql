-- Run in Supabase Dashboard → SQL Editor
alter table subscribers
  add column if not exists must_have_box boolean default false;
