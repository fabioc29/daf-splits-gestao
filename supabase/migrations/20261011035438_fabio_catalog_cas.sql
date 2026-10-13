-- Fabio additive adapter. D0/D1/D2/D3 remain immutable.
-- Requires the existing Fabio public_catalogs migration; never creates remote tables.
do $$begin
 if to_regclass('public.public_catalogs') is null then raise exception 'PUBLIC_CATALOG_SCHEMA_REQUIRED';end if;
end$$;
-- Signed-in visitors receive the same published snapshot already visible to anon.
create policy "Authenticated can read published catalogs" on public.public_catalogs
 for select to authenticated using(published=true);
create function private.daf_fabio_historical(v jsonb) returns boolean
language sql immutable set search_path='' as $$
 select case when jsonb_typeof(v->'historicalReceivable')='boolean' then (v->>'historicalReceivable')::boolean
 else coalesce((v->>'historical')::boolean,false) or
 (coalesce(v->>'channel','')<>'marketplace' and coalesce(v->>'marketplace','')='' and jsonb_array_length(coalesce(v->'items','[]'::jsonb))=0) end;
$$;
create function private.daf_fabio_preparation_tracked(v jsonb) returns boolean
language sql immutable set search_path='' as $$
 select case when jsonb_typeof(v->'preparationTracked')='boolean' then (v->>'preparationTracked')::boolean
 else jsonb_typeof(v->'prepared')='boolean' and not private.daf_fabio_historical(v) end;
$$;
create or replace function public.daf_crm_projection(p_data jsonb)
returns jsonb language sql immutable set search_path = '' as $$
 select jsonb_build_object(
  'products',coalesce((select jsonb_agg(jsonb_build_object('id',p->'id','externalId',p->'externalId','legacyIds',coalesce(p->'legacyIds',jsonb_build_array(p->'id')),'name',p->'name','brand',p->'brand','category',p->'category','gender',p->'gender','stock',p->'stock','apc',p->'apc','bottleNumber',p->'bottleNumber','bottleHistory',coalesce((select jsonb_agg(jsonb_build_object('number',b->'number','ml',b->'ml')) from jsonb_array_elements(coalesce(p->'bottleHistory','[]'::jsonb)) b),'[]'::jsonb))) from jsonb_array_elements(coalesce(p_data->'products','[]'::jsonb)) p),'[]'::jsonb),
  'clients',coalesce((select jsonb_agg(jsonb_build_object('id',c->'id','externalId',c->'externalId','legacyIds',coalesce(c->'legacyIds',jsonb_build_array(c->'id')),'cep',c->'cep','name',c->'name','phone',c->'phone','date',c->'date','addresses',coalesce(c->'addresses','[]'::jsonb))) from jsonb_array_elements(coalesce(p_data->'clients','[]'::jsonb)) c),'[]'::jsonb),
  'sales',coalesce((select jsonb_agg(jsonb_build_object('id',v->'id','externalId',v->'externalId','legacyIds',coalesce(v->'legacyIds',jsonb_build_array(v->'id')),'payment',v->'payment','historicalReceivable',to_jsonb(private.daf_fabio_historical(v)),'preparationTracked',to_jsonb(private.daf_fabio_preparation_tracked(v)),'clientId',v->'clientId','clientExternalId',(select c->'externalId' from jsonb_array_elements(coalesce(p_data->'clients','[]'::jsonb)) c where c->'id'=v->'clientId' limit 1),'date',v->'date','total',v->'total','paid',v->'paid','status',coalesce(v->'status','"active"'::jsonb),'prepared',coalesce(v->'prepared','false'::jsonb),'sent',coalesce(v->'sent','false'::jsonb),'channel',coalesce(v->'channel','"direct"'::jsonb),'marketplace',v->'marketplace','customerName',v->'customerName','items',coalesce((select jsonb_agg(jsonb_build_object('productId',i->'productId','productExternalId',(select p->'externalId' from jsonb_array_elements(coalesce(p_data->'products','[]'::jsonb)) p where p->'id'=i->'productId' limit 1),'ml',i->'ml','isApc',coalesce(i->'isApc','false'::jsonb))) from jsonb_array_elements(coalesce(v->'items','[]'::jsonb)) i),'[]'::jsonb))) from jsonb_array_elements(coalesce(p_data->'sales','[]'::jsonb)) v),'[]'::jsonb)
 );
$$;
revoke all on function public.daf_crm_projection(jsonb) from public, anon, authenticated;

-- Same safe stock fields used by Fabio's Catalog.tsx; image enrichment is optional.
create function private.daf_public_catalog_base(d jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p->'id','brand',btrim(coalesce(p->>'brand','')),
  'name',btrim(coalesce(p->>'name','')),'category',btrim(coalesce(nullif(p->>'category',''),'Outros')),
  'gender',btrim(coalesce(nullif(p->>'gender',''),'Unissex')),'stock',greatest((p->>'stock')::numeric,0),
  'apc',coalesce((p->>'apc')::numeric,0)>0)||
  case when coalesce((p->>'bottle')::numeric,0)>0 then jsonb_build_object('bottle',(p->>'bottle')::numeric) else '{}'::jsonb end
  order by (p->>'id')::bigint),'[]'::jsonb)
 from jsonb_array_elements(coalesce(d->'products','[]'::jsonb)) p where (p->>'stock')::numeric>0;
$$;
create function private.daf_catalog_statement_guard() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if not private.daf_shared_write_allowed() then raise exception 'CATALOG_CAS_REQUIRED' using errcode='42501';end if;
 perform pg_advisory_xact_lock(20261009,3);return null;
end$$;
create trigger daf_catalog_statement before insert or update or delete or truncate on public.public_catalogs
 for each statement execute function private.daf_catalog_statement_guard();

create function public.daf_publish_catalog(p_expected_revision text,p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.app_state; c public.public_catalogs; submitted jsonb; envelope jsonb;
begin
 perform private.daf_require_management_admin();
 perform pg_advisory_xact_lock(20261009,3);
 select * into s from public.app_state where user_id=auth.uid() for update;
 if not found or s.revision::text is distinct from p_expected_revision or s.data is distinct from
  (select data from public.management_state where id=1) then raise exception 'REVISION_CONFLICT' using errcode='40001';end if;
 if not public.daf_identities_ready(s.data) then raise exception 'IDENTITIES_ADOPTION_REQUIRED';end if;
 if jsonb_typeof(p_items) is distinct from 'array' or octet_length(p_items::text)>12000000 then raise exception 'INVALID_PUBLIC_CATALOG';end if;
 if (select count(*) from jsonb_array_elements(p_items) x where x ? '__catalogSettings')<>1 then raise exception 'INVALID_PUBLIC_CATALOG_SETTINGS';end if;
 select x->'__catalogSettings' into envelope from jsonb_array_elements(p_items) x where x ? '__catalogSettings';
 if envelope is distinct from s.data->'catalogSettings' or jsonb_typeof(envelope) is distinct from 'object'
 or exists(select 1 from jsonb_object_keys(envelope) k where k<>all(array[
  'background','header','card','text','muted','line','accent','whatsapp','whatsappText','apcAvailable','apcAvailableText',
  'apcUnavailable','apcUnavailableText','scarcity','groupBackground','groupBorder','groupButton','groupButtonText','manualImages'])) then
  raise exception 'INVALID_PUBLIC_CATALOG_SETTINGS';end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where x ? '__catalogSettings' and x<>'{}'::jsonb and
  (select count(*) from jsonb_object_keys(x))<>1)
 or exists(select 1 from jsonb_each(envelope) e where e.key<>'manualImages' and
  (jsonb_typeof(e.value)<>'string' or e.value#>>'{}' !~ '^#[a-fA-F0-9]{6}$'))
 or jsonb_typeof(envelope->'manualImages') is distinct from 'object'
 or exists(select 1 from jsonb_each(envelope->'manualImages') e where e.key !~ '^[0-9]+$' or jsonb_typeof(e.value)<>'string') then
  raise exception 'UNSAFE_PUBLIC_CATALOG_SETTINGS';end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where jsonb_typeof(x)<>'object' or
  exists(select 1 from jsonb_object_keys(x) k where k<>all(array[
   '__catalogSettings','id','brand','name','category','gender','stock','apc','bottle','imageUrl','fragranticaId','manualImage']))) then
  raise exception 'UNSAFE_PUBLIC_CATALOG_FIELD';end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where
  (x ? 'imageUrl' and jsonb_typeof(x->'imageUrl')<>'string') or
  (x ? 'fragranticaId' and (jsonb_typeof(x->'fragranticaId')<>'number' or x->>'fragranticaId' !~ '^[0-9]+$')) or
  (x ? 'manualImage' and jsonb_typeof(x->'manualImage')<>'boolean')) then
  raise exception 'UNSAFE_PUBLIC_CATALOG_IMAGE';end if;
 select coalesce(jsonb_agg(x-array['imageUrl','fragranticaId','manualImage'] order by (x->>'id')::bigint),'[]'::jsonb)
  into submitted from jsonb_array_elements(p_items) x where not (x ? '__catalogSettings');
 if submitted is distinct from private.daf_public_catalog_base(s.data) then raise exception 'PUBLIC_CATALOG_SNAPSHOT_MISMATCH';end if;
 -- The unique slug is shared by all admins; retain the existing catalog owner.
 if exists(select 1 from public.public_catalogs where user_id=auth.uid() and slug<>'daf-splits') then raise exception 'CATALOG_OWNER_CONFLICT';end if;
 perform private.daf_enter_shared_write();
 insert into public.public_catalogs(user_id,slug,name,published,items) values(auth.uid(),'daf-splits','DAF Splits',true,p_items)
 on conflict(slug) do update set name=excluded.name,published=excluded.published,items=excluded.items
 where public.public_catalogs.items is distinct from excluded.items or not public.public_catalogs.published;
 select * into c from public.public_catalogs where slug='daf-splits';
 perform private.daf_leave_shared_write();
 return jsonb_build_object('revision',s.revision::text,'published',c.published,'items',c.items,'updatedAt',c.updated_at);
end$$;
revoke insert,update,delete,truncate,references,trigger on public.public_catalogs from public,anon,authenticated,service_role;
revoke insert(user_id,slug,name,published,items,updated_at),update(user_id,slug,name,published,items,updated_at)
 on public.public_catalogs from public,anon,authenticated,service_role;
revoke all on function public.daf_publish_catalog(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.daf_publish_catalog(text,jsonb) to authenticated;
revoke all on function private.daf_fabio_historical(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.daf_fabio_preparation_tracked(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.daf_public_catalog_base(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.daf_catalog_statement_guard() from public,anon,authenticated,service_role;
revoke all on function public.daf_crm_projection(jsonb) from service_role;
notify pgrst,'reload schema';

