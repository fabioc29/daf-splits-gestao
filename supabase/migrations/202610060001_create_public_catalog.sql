create table if not exists public.public_catalogs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  slug text not null unique,
  name text not null default 'DAF Splits',
  published boolean not null default true,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint public_catalogs_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint public_catalogs_items_array
    check (jsonb_typeof(items) = 'array')
);

alter table public.public_catalogs enable row level security;

-- O Data API passou a exigir grants explícitos para novas tabelas.
grant select on public.public_catalogs to anon;
grant select, insert, update, delete on public.public_catalogs to authenticated;
grant select, insert, update, delete on public.public_catalogs to service_role;

drop policy if exists "Public can read published catalogs" on public.public_catalogs;
create policy "Public can read published catalogs"
on public.public_catalogs
for select
to anon
using (published = true);

drop policy if exists "Owners can read their catalog" on public.public_catalogs;
create policy "Owners can read their catalog"
on public.public_catalogs
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Owners can insert their catalog" on public.public_catalogs;
create policy "Owners can insert their catalog"
on public.public_catalogs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Owners can update their catalog" on public.public_catalogs;
create policy "Owners can update their catalog"
on public.public_catalogs
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Owners can delete their catalog" on public.public_catalogs;
create policy "Owners can delete their catalog"
on public.public_catalogs
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop trigger if exists public_catalogs_updated_at on public.public_catalogs;
create trigger public_catalogs_updated_at
before update on public.public_catalogs
for each row execute function public.set_app_state_updated_at();

comment on table public.public_catalogs is
  'Snapshot público e sanitizado do catálogo. Não armazena custos, vendas ou dados de clientes.';
