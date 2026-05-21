
alter table public.records add column if not exists ngay_nhan text;

create table if not exists public.legal_documents (
  id bigint generated always as identity primary key,
  drive_file_id text unique not null,
  title text,
  category text default 'Khác',
  mime_type text,
  source_url text,
  modified_time text,
  text_length integer,
  updated_at timestamptz default now()
);

create table if not exists public.legal_chunks (
  id bigint generated always as identity primary key,
  doc_id bigint references public.legal_documents(id) on delete cascade,
  drive_file_id text,
  doc_title text,
  category text default 'Khác',
  source_url text,
  chunk_index integer,
  content text,
  created_at timestamptz default now()
);

alter table public.legal_documents add column if not exists category text default 'Khác';
alter table public.legal_chunks add column if not exists category text default 'Khác';

alter table public.legal_documents enable row level security;
alter table public.legal_chunks enable row level security;

drop policy if exists "Allow all legal_documents" on public.legal_documents;
drop policy if exists "Allow all legal_chunks" on public.legal_chunks;

create policy "Allow all legal_documents" on public.legal_documents for all using (true) with check (true);
create policy "Allow all legal_chunks" on public.legal_chunks for all using (true) with check (true);
