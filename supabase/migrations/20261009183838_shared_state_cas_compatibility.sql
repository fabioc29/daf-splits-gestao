-- D3: shared-domain CAS and catalog compatibility. D0/D1/D2 are immutable.
-- Installation closes external management_state DML. app_state compatibility
-- ends only at the separately approved scripts/activate-shared-cas.sql cutover.
-- Pre-existing divergent states are refused, never silently reconciled.
do $$begin
 if to_regprocedure('private.propagate_shared_app_state()') is null
    or to_regprocedure('public.sync_management_catalog_stock()') is null then
  raise exception 'SHARED_TRIGGER_CHAIN_REQUIRED';
 end if;
 if not exists(select 1 from public.management_state where id=1) or exists(
  select 1 from public.app_state a join public.management_state m on m.id=1
  where a.data is distinct from m.data) then
  raise exception 'SHARED_STATE_DIVERGED';
 end if;
end$$;

create table private.daf_shared_cas_control (
 id boolean primary key default true check(id), enforced boolean not null default false
);
insert into private.daf_shared_cas_control(id,enforced) values(true,false);
create table private.daf_shared_write_context (
 backend_pid integer not null, transaction_id xid8 not null,
 primary key(backend_pid,transaction_id)
);
alter table private.daf_shared_cas_control enable row level security;
alter table private.daf_shared_write_context enable row level security;
revoke all on private.daf_shared_cas_control,private.daf_shared_write_context from public,anon,authenticated,service_role;
create index daf_external_aliases_shared_namespace on public.daf_external_aliases(external_id,kind);

create function private.daf_require_management_admin() returns void
language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not private.has_role(auth.uid(),'admin'::public.app_role) then
  raise exception 'Management admin required' using errcode='42501';
 end if;
end$$;
create function private.daf_enter_shared_write() returns void
language sql security definer set search_path='' as $$
 insert into private.daf_shared_write_context values(pg_backend_pid(),pg_current_xact_id()) on conflict do nothing;
$$;
create function private.daf_leave_shared_write() returns void
language sql security definer set search_path='' as $$
 delete from private.daf_shared_write_context where backend_pid=pg_backend_pid() and transaction_id=pg_current_xact_id();
$$;
create function private.daf_shared_write_allowed() returns boolean
language sql security definer set search_path='' as $$
 select exists(select 1 from private.daf_shared_write_context where backend_pid=pg_backend_pid() and transaction_id=pg_current_xact_id());
$$;
create function private.daf_shared_statement_guard() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if tg_table_name='management_state' or (tg_table_name='app_state' and
  (select enforced from private.daf_shared_cas_control where id)) then
  if not private.daf_shared_write_allowed() then raise exception 'CAS_REQUIRED' using errcode='42501'; end if;
 end if;
 -- BEFORE STATEMENT: the global domain lock always precedes any row locks.
 perform pg_advisory_xact_lock(20261009,3);
 return null;
end$$;
create trigger daf_shared_statement before insert or update or delete or truncate on public.app_state
 for each statement execute function private.daf_shared_statement_guard();
create trigger daf_shared_statement before insert or update or delete or truncate on public.management_state
 for each statement execute function private.daf_shared_statement_guard();
create trigger daf_shared_statement before insert or update or delete or truncate on public.management_product_links
 for each statement execute function private.daf_shared_statement_guard();
create trigger daf_shared_statement before insert or update or delete or truncate on public.perfumes
 for each statement execute function private.daf_shared_statement_guard();

-- Compare all business fields, removing ONLY the two identity metadata fields.
create function private.daf_business_state(d jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$declare k text;begin
 foreach k in array array['products','clients','sales'] loop
  d:=jsonb_set(d,array[k],coalesce((select jsonb_agg(value-array['externalId','legacyIds'] order by n)
    from jsonb_array_elements(coalesce(d->k,'[]'::jsonb)) with ordinality r(value,n)),'[]'::jsonb));
 end loop;
 return d;
end$$;
create function private.daf_catalog_state(d jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_array(coalesce(r->>'externalId','legacy:'||(r->>'id')),
   r-array['id','externalId','legacyIds']) order by coalesce(r->>'externalId','legacy:'||(r->>'id'))),'[]'::jsonb)
 from jsonb_array_elements(coalesce(d->'products','[]'::jsonb)) r;
$$;
create function private.daf_check_shared_namespace(d jsonb) returns void
language plpgsql security definer set search_path='' as $$declare k text;r jsonb;begin
 foreach k in array array['products','clients','sales'] loop
  if exists(select 1 from jsonb_array_elements(coalesce(d->k,'[]'::jsonb)) x
    group by x->>'externalId' having count(*)>1) then raise exception 'DUPLICATE_ID'; end if;
  for r in select value from jsonb_array_elements(coalesce(d->k,'[]'::jsonb)) loop
   if coalesce(r->>'externalId','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception 'INVALID_EXTERNAL_ID'; end if;
   if exists(select 1 from public.daf_external_aliases where external_id=(r->>'externalId')::uuid and kind<>k) then
    raise exception 'IDENTITY_NAMESPACE_MISMATCH';
   end if;
   if exists(select 1 from (values('products'),('clients'),('sales')) e(kind)
    cross join lateral jsonb_array_elements(coalesce(d->e.kind,'[]'::jsonb)) x
    where e.kind<>k and x->>'externalId'=r->>'externalId') then
    raise exception 'IDENTITY_NAMESPACE_MISMATCH';
   end if;
  end loop;
 end loop;
end$$;
create function private.daf_register_shared_aliases(d jsonb) returns void
language plpgsql security definer set search_path='' as $$declare k text;r jsonb;begin
 foreach k in array array['products','clients','sales'] loop
  for r in select value from jsonb_array_elements(coalesce(d->k,'[]'::jsonb)) loop
   -- Compatibility can still contain pre-adoption records; never generate IDs here.
   if coalesce(r->>'externalId','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then continue; end if;
   insert into public.daf_external_aliases(user_id,kind,external_id,legacy_id,first_revision,last_revision)
    select distinct a.user_id,k,(r->>'externalId')::uuid,v.value#>>'{}',a.revision,a.revision
    from public.app_state a cross join lateral jsonb_array_elements(
      coalesce(r->'legacyIds','[]'::jsonb)||jsonb_build_array(r->'id')) v(value)
    where a.data=d
    on conflict(user_id,kind,external_id,legacy_id) do update set last_revision=excluded.last_revision;
  end loop;
 end loop;
end$$;

create or replace function private.propagate_shared_app_state() returns trigger
language plpgsql security definer set search_path='' as $$declare entered boolean;begin
 if pg_trigger_depth()>1 then return new; end if;
 entered:=not private.daf_shared_write_allowed();
 if entered then perform private.daf_enter_shared_write(); end if;
 update public.management_state set data=new.data,updated_at=now(),updated_by=new.user_id
  where id=1 and data is distinct from new.data;
 update public.app_state set data=new.data,updated_at=now()
  where user_id<>new.user_id and data is distinct from new.data;
 perform private.daf_register_shared_aliases(new.data);
 if entered then perform private.daf_leave_shared_write(); end if;
 return new;
end$$;

create function private.daf_move_catalog_aliases(previous jsonb,next jsonb) returns void
language plpgsql security definer set search_path='' as $$declare p jsonb;o jsonb;old_id bigint;new_id bigint;begin
 if exists(select 1 from jsonb_array_elements(coalesce(next->'products','[]'::jsonb)) x
   where coalesce(x->>'id','') !~ '^[0-9]+$') then raise exception 'CATALOG_ALIAS_CONFLICT'; end if;
 if exists(select 1 from jsonb_array_elements(coalesce(next->'products','[]'::jsonb)) x
   group by (x->>'id')::bigint having count(*)>1) then raise exception 'CATALOG_ALIAS_CONFLICT'; end if;
 -- Validate the WHOLE mapping before relocating any link (swaps/collisions fail).
 for p in select value from jsonb_array_elements(coalesce(next->'products','[]'::jsonb)) loop
  select value into o from jsonb_array_elements(coalesce(previous->'products','[]'::jsonb))
   where value->>'id'=p->>'id';
  if o is not null and o->>'externalId' is distinct from p->>'externalId' and exists(
    select 1 from public.management_product_links where management_product_id=(p->>'id')::bigint) then
   raise exception 'CATALOG_ALIAS_CONFLICT';
  end if;
  select value into o from jsonb_array_elements(coalesce(previous->'products','[]'::jsonb))
   where value->>'externalId'=p->>'externalId' and coalesce(p->>'externalId','')<>'';
  if o is null or o->>'id'=p->>'id' then continue; end if;
  old_id:=(o->>'id')::bigint;new_id:=(p->>'id')::bigint;
  if not exists(select 1 from public.management_product_links where management_product_id=old_id)
     or exists(select 1 from public.management_product_links where management_product_id=new_id) then
   raise exception 'CATALOG_ALIAS_CONFLICT';
  end if;
 end loop;
 for p in select value from jsonb_array_elements(coalesce(next->'products','[]'::jsonb)) loop
  select value into o from jsonb_array_elements(coalesce(previous->'products','[]'::jsonb))
   where value->>'externalId'=p->>'externalId' and coalesce(p->>'externalId','')<>'';
  if o is not null and o->>'id' is distinct from p->>'id' then
   update public.management_product_links set management_product_id=(p->>'id')::bigint
    where management_product_id=(o->>'id')::bigint;
  end if;
 end loop;
end$$;
create or replace function private.sync_catalog_after_management_state() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if tg_op='UPDATE' then
  if private.daf_business_state(old.data)=private.daf_business_state(new.data) then return new; end if;
  perform private.daf_move_catalog_aliases(old.data,new.data);
  if private.daf_catalog_state(old.data)=private.daf_catalog_state(new.data) then return new; end if;
 end if;
 perform private.ensure_management_catalog_products();
 perform public.sync_management_catalog_stock();
 return new;
end$$;
create or replace function private.sync_catalog_after_management_link() returns trigger
language plpgsql security definer set search_path='' as $$declare old_perfume_id uuid;begin
 if tg_op='UPDATE' and private.daf_shared_write_allowed() and
   (to_jsonb(old)-'management_product_id')=(to_jsonb(new)-'management_product_id') then return new; end if;
 perform public.sync_management_catalog_stock();
 if tg_op='DELETE' then old_perfume_id:=old.perfume_id;
 elsif tg_op='UPDATE' and old.perfume_id is distinct from new.perfume_id then old_perfume_id:=old.perfume_id; end if;
 if old_perfume_id is not null and not exists(select 1 from public.management_product_links where perfume_id=old_perfume_id) then
  update public.perfumes set stock_ml=null,stock_synced_at=now(),available=false where id=old_perfume_id;
 end if;
 if tg_op='DELETE' then return old; end if;return new;
end$$;

create function public.daf_bootstrap_app_state() returns jsonb
language plpgsql security definer set search_path='' as $$declare s public.app_state;shared jsonb;begin
 perform private.daf_require_management_admin();
 perform pg_advisory_xact_lock(20261009,3);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into s from public.app_state where user_id=auth.uid() for update;
 if not found then
  select data into shared from public.management_state where id=1;
  if shared is null then raise exception 'SHARED_STATE_REQUIRED'; end if;
  perform private.daf_enter_shared_write();
  insert into public.app_state(user_id,data,writer_policy)
   values(auth.uid(),shared,case when (select enforced from private.daf_shared_cas_control where id) then 'cas-only' else 'compatibility' end)
   returning * into s;
  perform private.daf_register_shared_aliases(s.data);
  perform private.daf_leave_shared_write();
 end if;
 return jsonb_build_object('data',s.data,'revision',s.revision::text,'identitiesReady',public.daf_identities_ready(s.data));
end$$;

-- No API/service writer can update the shared singleton directly.
revoke insert,update,delete,truncate,references,trigger on public.management_state from public,anon,authenticated,service_role;
revoke trigger on public.app_state from public,anon,authenticated,service_role;
revoke insert(id,data,updated_at,updated_by),update(id,data,updated_at,updated_by) on public.management_state from public,anon,authenticated,service_role;

create or replace function public.daf_read_app_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.app_state;
begin
 perform private.daf_require_management_admin();
 select * into s from public.app_state where user_id=auth.uid();
 if not found then return jsonb_build_object('data',null,'revision','0','identitiesReady',true); end if;
 return jsonb_build_object('data',s.data,'revision',s.revision::text,'identitiesReady',public.daf_identities_ready(s.data));
end $$;
revoke all on function public.daf_read_app_state() from public,anon;
grant execute on function public.daf_read_app_state() to authenticated;


create or replace function public.daf_adopt_external_ids(p_expected_revision text,p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.app_state; d jsonb; k text; r jsonb; rows jsonb; n integer := 0;
begin
 perform private.daf_require_management_admin();
 perform pg_advisory_xact_lock(20261009,3);
 select * into s from public.app_state where user_id=auth.uid() for update;
 if not found then raise exception 'No saved dashboard state'; end if;
 if s.data is distinct from (select data from public.management_state where id=1) then raise exception 'SHARED_STATE_DIVERGED' using errcode='40001'; end if;
 if s.revision::text is distinct from p_expected_revision then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
 d := s.data;
 foreach k in array array['products','clients','sales'] loop
  rows := '[]'::jsonb;
  for r in select value from jsonb_array_elements(coalesce(d->k,'[]'::jsonb)) loop
   if coalesce(r->>'externalId','')='' then r := r||jsonb_build_object('externalId',gen_random_uuid()::text); n := n+1;
   elsif r->>'externalId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception 'INVALID_EXTERNAL_ID'; end if;
   r := r||jsonb_build_object('legacyIds',coalesce(r->'legacyIds',jsonb_build_array(r->'id')));
   rows := rows||jsonb_build_array(r);

  end loop;
  d := jsonb_set(d,array[k],rows);
 end loop;
 perform private.daf_check_shared_namespace(d);
 if not p_dry_run then
  perform private.daf_enter_shared_write();
  if d is distinct from s.data then update public.app_state set data=d where user_id=auth.uid() returning * into s; end if;
  perform private.daf_register_shared_aliases(d);
  perform private.daf_leave_shared_write();
 end if;
 return jsonb_build_object('dryRun',p_dry_run,'adopted',n,'revision',s.revision::text,
 'counts',jsonb_build_object('products',jsonb_array_length(d->'products'),'clients',jsonb_array_length(d->'clients'),'sales',jsonb_array_length(d->'sales')));
end $$;
revoke all on function public.daf_adopt_external_ids(text,boolean) from public,anon;
grant execute on function public.daf_adopt_external_ids(text,boolean) to authenticated;


create or replace function public.daf_save_app_state(p_expected_revision text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.app_state; d jsonb := p_data; k text; r jsonb; prior jsonb; v bigint; persisted jsonb; rows jsonb;
begin
 perform private.daf_require_management_admin();
 perform pg_advisory_xact_lock(20261009,3);
 if p_expected_revision is null or p_expected_revision !~ '^[0-9]+$' or jsonb_typeof(d)<>'object' or octet_length(d::text)>12000000 then raise exception 'INVALID_STATE'; end if;
 -- Serializes initial inserts too: absent rows cannot be protected by FOR UPDATE.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into s from public.app_state where user_id=auth.uid() for update;
 if not found then raise exception 'STATE_BOOTSTRAP_REQUIRED' using errcode='40001'; end if;
 if s.data is distinct from (select data from public.management_state where id=1) then raise exception 'SHARED_STATE_DIVERGED' using errcode='40001'; end if;
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
   if exists(select 1 from public.daf_external_aliases where external_id=(r->>'externalId')::uuid and kind<>k) then raise exception 'IDENTITY_NAMESPACE_MISMATCH'; end if;

  end loop;
  d := jsonb_set(d,array[k],rows);
 end loop;
 if exists(select 1 from jsonb_array_elements(d->'products') x where jsonb_typeof(x->'stock') is distinct from 'number' or (x->>'stock')::numeric<0) then raise exception 'INVALID_STOCK'; end if;
 perform private.daf_check_shared_namespace(d);
 perform private.daf_enter_shared_write();
 insert into public.app_state(user_id,data) values(auth.uid(),d)
 on conflict(user_id) do update set data=excluded.data returning revision,data into v,persisted;
 perform private.daf_register_shared_aliases(persisted);
 perform private.daf_leave_shared_write();
 return jsonb_build_object('revision',v::text,'data',persisted);
end $$;
revoke all on function public.daf_save_app_state(text,jsonb) from public,anon;
grant execute on function public.daf_save_app_state(text,jsonb) to authenticated;

revoke all on function private.daf_require_management_admin() from public,anon,authenticated,service_role;
revoke all on function private.daf_enter_shared_write() from public,anon,authenticated,service_role;
revoke all on function private.daf_leave_shared_write() from public,anon,authenticated,service_role;
revoke all on function private.daf_shared_write_allowed() from public,anon,authenticated,service_role;
revoke all on function private.daf_shared_statement_guard() from public,anon,authenticated,service_role;
revoke all on function private.daf_business_state(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.daf_catalog_state(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.daf_check_shared_namespace(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.daf_register_shared_aliases(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.daf_move_catalog_aliases(jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.daf_bootstrap_app_state() from public,anon,authenticated,service_role;
grant execute on function public.daf_bootstrap_app_state() to authenticated;
revoke all on function public.daf_read_app_state() from public,anon,authenticated,service_role;
grant execute on function public.daf_read_app_state() to authenticated;
revoke all on function public.daf_adopt_external_ids(text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.daf_adopt_external_ids(text,boolean) to authenticated;
revoke all on function public.daf_save_app_state(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.daf_save_app_state(text,jsonb) to authenticated;
notify pgrst,'reload schema';
