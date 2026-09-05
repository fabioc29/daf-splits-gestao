create table if not exists public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "Users can read their own app data" on public.app_state;
create policy "Users can read their own app data" on public.app_state
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own app data" on public.app_state;
create policy "Users can insert their own app data" on public.app_state
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own app data" on public.app_state;
create policy "Users can update their own app data" on public.app_state
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.set_app_state_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists app_state_updated_at on public.app_state;
create trigger app_state_updated_at before update on public.app_state
for each row execute function public.set_app_state_updated_at();
