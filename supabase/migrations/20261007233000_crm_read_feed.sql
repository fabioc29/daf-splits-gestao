-- A dedicated, revocable read capability. No grants on app_state are changed.
create table if not exists public.daf_crm_tokens (
 user_id uuid primary key references auth.users(id) on delete cascade,
 token_hash text not null unique,
 created_at timestamptz not null default now()
);
alter table public.daf_crm_tokens enable row level security;
revoke all on public.daf_crm_tokens from public, anon, authenticated;

create or replace function public.daf_crm_projection(p_data jsonb)
returns jsonb language sql immutable set search_path = '' as $$
 select jsonb_build_object(
  'products',coalesce((select jsonb_agg(jsonb_build_object('id',p->'id','name',p->'name','brand',p->'brand','category',p->'category','gender',p->'gender','stock',p->'stock','apc',p->'apc','bottleNumber',p->'bottleNumber','bottleHistory',coalesce((select jsonb_agg(jsonb_build_object('number',b->'number','ml',b->'ml')) from jsonb_array_elements(coalesce(p->'bottleHistory','[]'::jsonb)) b),'[]'::jsonb))) from jsonb_array_elements(coalesce(p_data->'products','[]'::jsonb)) p),'[]'::jsonb),
  'clients',coalesce((select jsonb_agg(jsonb_build_object('id',c->'id','name',c->'name','phone',c->'phone','date',c->'date','addresses',coalesce(c->'addresses','[]'::jsonb))) from jsonb_array_elements(coalesce(p_data->'clients','[]'::jsonb)) c),'[]'::jsonb),
  'sales',coalesce((select jsonb_agg(jsonb_build_object('id',v->'id','clientId',v->'clientId','date',v->'date','total',v->'total','paid',v->'paid','status',coalesce(v->'status','"active"'::jsonb),'prepared',coalesce(v->'prepared','false'::jsonb),'sent',coalesce(v->'sent','false'::jsonb),'channel',coalesce(v->'channel','"direct"'::jsonb),'marketplace',v->'marketplace','customerName',v->'customerName','items',coalesce((select jsonb_agg(jsonb_build_object('productId',i->'productId','ml',i->'ml','isApc',coalesce(i->'isApc','false'::jsonb))) from jsonb_array_elements(coalesce(v->'items','[]'::jsonb)) i),'[]'::jsonb))) from jsonb_array_elements(coalesce(p_data->'sales','[]'::jsonb)) v),'[]'::jsonb)
 );
$$;
revoke all on function public.daf_crm_projection(jsonb) from public, anon, authenticated;

create or replace function public.daf_crm_issue_token()
returns text language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_token text;
begin
 if v_owner is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.app_state where user_id=v_owner) then raise exception 'No saved dashboard state'; end if;
 v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','');
 insert into public.daf_crm_tokens(user_id,token_hash) values(v_owner,encode(sha256(convert_to(v_token,'UTF8')),'hex'))
 on conflict(user_id) do update set token_hash=excluded.token_hash,created_at=now();
 return v_token;
end;
$$;
revoke all on function public.daf_crm_issue_token() from public, anon;
grant execute on function public.daf_crm_issue_token() to authenticated;

create or replace function public.daf_crm_revoke_token()
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 delete from public.daf_crm_tokens where user_id=auth.uid();
end;
$$;
revoke all on function public.daf_crm_revoke_token() from public, anon;
grant execute on function public.daf_crm_revoke_token() to authenticated;

create or replace function public.daf_crm_feed(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_data jsonb; v_revision timestamptz;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Invalid read capability' using errcode='28000'; end if;
 select user_id into v_owner from public.daf_crm_tokens where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 if v_owner is null then raise exception 'Invalid read capability' using errcode='28000'; end if;
 select data,updated_at into v_data,v_revision from public.app_state where user_id=v_owner;
 if not found then raise exception 'Dashboard unavailable'; end if;
 return jsonb_build_object('format','daf-crm-feed-v2','meta',jsonb_build_object('identity','daf-gestao:'||v_owner::text,'revision',v_revision,'exportedAt',now(),'stockModel','product-bottle-evidence-v1'),'data',public.daf_crm_projection(v_data));
end;
$$;
revoke all on function public.daf_crm_feed(text) from public;
grant execute on function public.daf_crm_feed(text) to anon, authenticated;
