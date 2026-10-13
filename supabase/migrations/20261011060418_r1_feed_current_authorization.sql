-- R1: additive authorization after D3 and Fabio. No data or historical migration changes.
-- Conditional reads call daf_crm_feed and therefore repeat the same owner role check.
-- daf_crm_revoke_token is deliberately unchanged: former admins can revoke their own token.
create or replace function public.daf_crm_issue_token()
returns text language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_token text;
begin
 perform private.daf_require_management_admin();
 if not exists(select 1 from public.app_state where user_id=v_owner) then raise exception 'No saved dashboard state'; end if;
 v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','');
 insert into public.daf_crm_tokens(user_id,token_hash) values(v_owner,encode(sha256(convert_to(v_token,'UTF8')),'hex'))
 on conflict(user_id) do update set token_hash=excluded.token_hash,created_at=now();
 return v_token;
end;
$$;
revoke all on function public.daf_crm_issue_token() from public, anon;
grant execute on function public.daf_crm_issue_token() to authenticated;

create or replace function public.daf_crm_feed(p_token text, p_contract_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_data jsonb; v_revision timestamptz; v_version bigint; v_writer text; v_projection jsonb;
begin
 if p_contract_version is distinct from 'daf-crm-feed-v2' then raise exception 'CRM contract v2 required' using errcode='22023'; end if;
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Invalid read capability' using errcode='28000'; end if;
 select user_id into v_owner from public.daf_crm_tokens where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 if v_owner is null or not private.has_role(v_owner,'admin'::public.app_role) then
  raise exception 'Invalid read capability' using errcode='28000';
 end if;
 select data,updated_at,revision,writer_policy into v_data,v_revision,v_version,v_writer from public.app_state where user_id=v_owner;
 if not found then raise exception 'Dashboard unavailable'; end if;
 v_projection := public.daf_crm_projection(v_data);
 return jsonb_build_object('format','daf-crm-feed-v2','meta',jsonb_build_object('identity','daf-gestao:'||v_owner::text,'revision',v_revision,'stateVersion',v_version::text,'schemaVersion',1,'writerPolicy',v_writer,'identityReady',public.daf_identities_ready(v_data),'snapshotHash',encode(sha256(convert_to(v_projection::text,'UTF8')),'hex'),'exportedAt',now(),'stockModel','product-bottle-evidence-v1'),'data',v_projection);
end;
$$;
revoke all on function public.daf_crm_feed(text,text) from public;
grant execute on function public.daf_crm_feed(text,text) to anon, authenticated;

