-- D1: additive revision/CAS. Does NOT revoke existing writers during rollout.
alter table public.app_state add column if not exists revision bigint not null default 0;
alter table public.app_state add column if not exists schema_version integer not null default 1;
alter table public.app_state add column if not exists writer_policy text not null default 'compatibility';
create table public.daf_external_aliases (
 user_id uuid not null references auth.users(id), kind text not null, external_id uuid not null,
 legacy_id text not null, first_revision bigint not null, last_revision bigint not null,
 primary key(user_id,kind,external_id,legacy_id)
);
alter table public.daf_external_aliases enable row level security;
revoke all on public.daf_external_aliases from public,anon,authenticated;

create function public.daf_bump_state_revision() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then new.revision := 1;
 else new.revision := old.revision+1; end if;
 new.updated_at := clock_timestamp();
 return new;
end $$;
revoke all on function public.daf_bump_state_revision() from public,anon,authenticated;
create trigger daf_state_monotonic before insert or update on public.app_state for each row execute function public.daf_bump_state_revision();

create function public.daf_identities_ready(d jsonb) returns boolean language sql immutable set search_path='' as $$
 select not exists(select 1 from jsonb_array_elements(coalesce(d->'products','[]'::jsonb)||coalesce(d->'clients','[]'::jsonb)||coalesce(d->'sales','[]'::jsonb)) r
 where coalesce(r->>'externalId','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$');
$$;
revoke all on function public.daf_identities_ready(jsonb) from public,anon,authenticated;

create function public.daf_read_app_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.app_state;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select * into s from public.app_state where user_id=auth.uid();
 if not found then return jsonb_build_object('data',null,'revision','0','identitiesReady',true); end if;
 return jsonb_build_object('data',s.data,'revision',s.revision::text,'identitiesReady',public.daf_identities_ready(s.data));
end $$;
revoke all on function public.daf_read_app_state() from public,anon;
grant execute on function public.daf_read_app_state() to authenticated;

-- Explicit, authorized metadata adoption. Default dry-run; never called by a read/feed.
create function public.daf_adopt_external_ids(p_expected_revision text,p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.app_state; d jsonb; k text; r jsonb; rows jsonb; n integer := 0;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select * into s from public.app_state where user_id=auth.uid() for update;
 if not found then raise exception 'No saved dashboard state'; end if;
 if s.revision::text is distinct from p_expected_revision then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
 d := s.data;
 foreach k in array array['products','clients','sales'] loop
  rows := '[]'::jsonb;
  for r in select value from jsonb_array_elements(coalesce(d->k,'[]'::jsonb)) loop
   if coalesce(r->>'externalId','')='' then r := r||jsonb_build_object('externalId',gen_random_uuid()::text); n := n+1;
   elsif r->>'externalId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception 'INVALID_EXTERNAL_ID'; end if;
   r := r||jsonb_build_object('legacyIds',coalesce(r->'legacyIds',jsonb_build_array(r->'id')));
   rows := rows||jsonb_build_array(r);
   if not p_dry_run then
    insert into public.daf_external_aliases values(auth.uid(),k,(r->>'externalId')::uuid,r->>'id',s.revision+1,s.revision+1)
    on conflict(user_id,kind,external_id,legacy_id) do nothing;
   end if;
  end loop;
  d := jsonb_set(d,array[k],rows);
 end loop;
 if not p_dry_run and n>0 then update public.app_state set data=d where user_id=auth.uid(); end if;
 return jsonb_build_object('dryRun',p_dry_run,'adopted',n,'revision',(s.revision+case when not p_dry_run and n>0 then 1 else 0 end)::text,
 'counts',jsonb_build_object('products',jsonb_array_length(d->'products'),'clients',jsonb_array_length(d->'clients'),'sales',jsonb_array_length(d->'sales')));
end $$;
revoke all on function public.daf_adopt_external_ids(text,boolean) from public,anon;
grant execute on function public.daf_adopt_external_ids(text,boolean) to authenticated;

create function public.daf_save_app_state(p_expected_revision text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.app_state; d jsonb := p_data; k text; r jsonb; prior jsonb; v bigint; rows jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_expected_revision is null or p_expected_revision !~ '^[0-9]+$' or jsonb_typeof(d)<>'object' or octet_length(d::text)>12000000 then raise exception 'INVALID_STATE'; end if;
 -- Serializes initial inserts too: absent rows cannot be protected by FOR UPDATE.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into s from public.app_state where user_id=auth.uid() for update;
 if coalesce(s.revision,0)::text is distinct from p_expected_revision then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
 if s.data is not null and not public.daf_identities_ready(s.data) then raise exception 'IDENTITIES_ADOPTION_REQUIRED'; end if;
 foreach k in array array['products','clients','sales'] loop
  if jsonb_typeof(d->k) is distinct from 'array' then raise exception 'INVALID_STATE'; end if;
  if exists(select 1 from jsonb_array_elements(d->k) x group by x->>'externalId' having count(*)>1) or
   exists(select 1 from jsonb_array_elements(d->k) x group by x->>'id' having count(*)>1) then raise exception 'DUPLICATE_ID'; end if;
  rows := '[]'::jsonb;
  for r in select value from jsonb_array_elements(d->k) loop
   if coalesce(r->>'externalId','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception 'INVALID_EXTERNAL_ID'; end if;
   select value into prior from jsonb_array_elements(coalesce(s.data->k,'[]'::jsonb)) where value->>'externalId'=r->>'externalId';
   r := r||jsonb_build_object('legacyIds',(select jsonb_agg(distinct a) from jsonb_array_elements(coalesce(prior->'legacyIds','[]'::jsonb)||jsonb_build_array(r->'id')) a));
   rows := rows||jsonb_build_array(r);
   -- A known UUID remains in its entity namespace even if the display number changes.
   if exists(select 1 from public.daf_external_aliases where user_id=auth.uid() and external_id=(r->>'externalId')::uuid and kind<>k) then raise exception 'IDENTITY_NAMESPACE_MISMATCH'; end if;
   insert into public.daf_external_aliases values(auth.uid(),k,(r->>'externalId')::uuid,r->>'id',coalesce(s.revision,0)+1,coalesce(s.revision,0)+1)
   on conflict(user_id,kind,external_id,legacy_id) do update set last_revision=excluded.last_revision;
  end loop;
  d := jsonb_set(d,array[k],rows);
 end loop;
 if exists(select 1 from jsonb_array_elements(d->'products') x where jsonb_typeof(x->'stock') is distinct from 'number' or (x->>'stock')::numeric<0) then raise exception 'INVALID_STOCK'; end if;
 insert into public.app_state(user_id,data) values(auth.uid(),d)
 on conflict(user_id) do update set data=excluded.data returning revision into v;
 return jsonb_build_object('revision',v::text,'data',d);
end $$;
revoke all on function public.daf_save_app_state(text,jsonb) from public,anon;
grant execute on function public.daf_save_app_state(text,jsonb) to authenticated;
-- Old direct writers remain functional until the separate, explicit cutover script.
