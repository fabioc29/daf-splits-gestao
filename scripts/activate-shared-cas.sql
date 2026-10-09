-- EXPLICIT coordinated cutover, AFTER D3, backup and all dashboard writers updated.
-- Never run automatically in production. CI runs this only on disposable fixtures.
begin;
select pg_advisory_xact_lock(20261009,3);
do $$begin
 if exists(select 1 from public.app_state where not public.daf_identities_ready(data)) then
  raise exception 'IDENTITIES_ADOPTION_REQUIRED';
 end if;
 if exists(select 1 from public.app_state a join public.management_state m on m.id=1 where a.data is distinct from m.data) then
  raise exception 'SHARED_STATE_DIVERGED';
 end if;
end$$;
select private.daf_enter_shared_write();
update private.daf_shared_cas_control set enforced=true where id;
update public.app_state set writer_policy='cas-only' where writer_policy<>'cas-only';
revoke insert,update,delete,truncate,references,trigger on public.app_state,public.management_state from public,anon,authenticated,service_role;
revoke insert(user_id,data,updated_at,revision,schema_version,writer_policy),update(user_id,data,updated_at,revision,schema_version,writer_policy) on public.app_state from public,anon,authenticated,service_role;
revoke insert(id,data,updated_at,updated_by),update(id,data,updated_at,updated_by) on public.management_state from public,anon,authenticated,service_role;
select private.daf_leave_shared_write();
commit;
