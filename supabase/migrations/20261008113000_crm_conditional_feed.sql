-- D2: additive feed v2 fields and conditional reads. No business data transformation.
create or replace function public.daf_crm_projection(p_data jsonb)
returns jsonb language sql immutable set search_path = '' as $$
 select jsonb_build_object(
  'products',coalesce((select jsonb_agg(jsonb_build_object('id',p->'id','externalId',p->'externalId','legacyIds',coalesce(p->'legacyIds',jsonb_build_array(p->'id')),'name',p->'name','brand',p->'brand','category',p->'category','gender',p->'gender','stock',p->'stock','apc',p->'apc','bottleNumber',p->'bottleNumber','bottleHistory',coalesce((select jsonb_agg(jsonb_build_object('number',b->'number','ml',b->'ml')) from jsonb_array_elements(coalesce(p->'bottleHistory','[]'::jsonb)) b),'[]'::jsonb))) from jsonb_array_elements(coalesce(p_data->'products','[]'::jsonb)) p),'[]'::jsonb),
  'clients',coalesce((select jsonb_agg(jsonb_build_object('id',c->'id','externalId',c->'externalId','legacyIds',coalesce(c->'legacyIds',jsonb_build_array(c->'id')),'cep',c->'cep','name',c->'name','phone',c->'phone','date',c->'date','addresses',coalesce(c->'addresses','[]'::jsonb))) from jsonb_array_elements(coalesce(p_data->'clients','[]'::jsonb)) c),'[]'::jsonb),
  'sales',coalesce((select jsonb_agg(jsonb_build_object('id',v->'id','externalId',v->'externalId','legacyIds',coalesce(v->'legacyIds',jsonb_build_array(v->'id')),'payment',v->'payment','historicalReceivable',coalesce(v->'historicalReceivable','false'::jsonb),'preparationTracked',coalesce(v->'preparationTracked','false'::jsonb),'clientId',v->'clientId','clientExternalId',(select c->'externalId' from jsonb_array_elements(coalesce(p_data->'clients','[]'::jsonb)) c where c->'id'=v->'clientId' limit 1),'date',v->'date','total',v->'total','paid',v->'paid','status',coalesce(v->'status','"active"'::jsonb),'prepared',coalesce(v->'prepared','false'::jsonb),'sent',coalesce(v->'sent','false'::jsonb),'channel',coalesce(v->'channel','"direct"'::jsonb),'marketplace',v->'marketplace','customerName',v->'customerName','items',coalesce((select jsonb_agg(jsonb_build_object('productId',i->'productId','productExternalId',(select p->'externalId' from jsonb_array_elements(coalesce(p_data->'products','[]'::jsonb)) p where p->'id'=i->'productId' limit 1),'ml',i->'ml','isApc',coalesce(i->'isApc','false'::jsonb))) from jsonb_array_elements(coalesce(v->'items','[]'::jsonb)) i),'[]'::jsonb))) from jsonb_array_elements(coalesce(p_data->'sales','[]'::jsonb)) v),'[]'::jsonb)
 );
$$;
revoke all on function public.daf_crm_projection(jsonb) from public, anon, authenticated;

create or replace function public.daf_crm_feed(p_token text, p_contract_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_data jsonb; v_revision timestamptz; v_version bigint; v_writer text; v_projection jsonb;
begin
 if p_contract_version is distinct from 'daf-crm-feed-v2' then raise exception 'CRM contract v2 required' using errcode='22023'; end if;
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Invalid read capability' using errcode='28000'; end if;
 select user_id into v_owner from public.daf_crm_tokens where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 if v_owner is null then raise exception 'Invalid read capability' using errcode='28000'; end if;
 select data,updated_at,revision,writer_policy into v_data,v_revision,v_version,v_writer from public.app_state where user_id=v_owner;
 if not found then raise exception 'Dashboard unavailable'; end if;
 v_projection := public.daf_crm_projection(v_data);
 return jsonb_build_object('format','daf-crm-feed-v2','meta',jsonb_build_object('identity','daf-gestao:'||v_owner::text,'revision',v_revision,'stateVersion',v_version::text,'schemaVersion',1,'writerPolicy',v_writer,'identityReady',public.daf_identities_ready(v_data),'snapshotHash',encode(sha256(convert_to(v_projection::text,'UTF8')),'hex'),'exportedAt',now(),'stockModel','product-bottle-evidence-v1'),'data',v_projection);
end;
$$;
revoke all on function public.daf_crm_feed(text,text) from public;
grant execute on function public.daf_crm_feed(text,text) to anon, authenticated;

create function public.daf_crm_sync_feed(p_token text,p_contract_version text,p_known_revision text default null,p_known_state_version text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare f jsonb;
begin
 f := public.daf_crm_feed(p_token,p_contract_version);
 if f->'meta'->>'revision'=p_known_revision and f->'meta'->>'stateVersion'=p_known_state_version then
  return jsonb_build_object('format','daf-crm-feed-v2','changed',false,'meta',f->'meta');
 end if;
 return f||jsonb_build_object('changed',true);
end $$;
revoke all on function public.daf_crm_sync_feed(text,text,text,text) from public;
grant execute on function public.daf_crm_sync_feed(text,text,text,text) to anon,authenticated;
