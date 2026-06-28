create table if not exists watches (
  id              bigint generated always as identity primary key,
  source          text,
  title           text,
  brand           text,
  reference_number text,
  price           numeric,
  image_url       text,
  url             text,
  condition       text,
  year            integer,
  ai_summary      text,
  deal_score      numeric,
  created_at      timestamptz default now()
);
