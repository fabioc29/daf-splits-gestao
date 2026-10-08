-- NOT a migration, NOT run on build. Requires an authorized maintenance window.
-- First deploy/validate the updated dashboard, adopt UUIDs with dry-run/backup,
-- close old tabs/clients, verify only daf_save_app_state writes, then run explicitly.
-- This operation changes authorization, not stock. Never execute automatically.
begin;
do $$ begin
 if exists(select 1 from public.app_state where not public.daf_identities_ready(data)) then
  raise exception 'Adopt identities before cutover'; end if;
end $$;
revoke insert,update,delete on public.app_state from authenticated,anon;
update public.app_state set writer_policy='cas-only';
commit;
