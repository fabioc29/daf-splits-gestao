import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {crmProjection} from '../src/crm/projection.ts';

const owner='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const fixture={products:[{id:7,name:'Perfume',brand:'DAF',stock:140,apc:1,cost:123,bottleNumber:2,bottleHistory:[{number:1,ml:100,purchaseId:999},{number:2,ml:100,purchaseId:998}]}],clients:[{id:1,name:'Teste',phone:'31999990000',cpf:'DO-NOT-EXPORT',date:'2026-10-07',addresses:[]}],sales:[{id:1,clientId:1,date:'2026-10-07',total:100,paid:100,status:'active',items:[{productId:7,ml:60,unitCost:99}]}],expenses:[{secret:'DO-NOT-EXPORT'}]};

test('PostgreSQL feed: account scope, revocation, read-only grants and bottle evidence',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
   CREATE TABLE auth.users(id uuid PRIMARY KEY);
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
   INSERT INTO auth.users VALUES ('${owner}'),('${other}');`);
  await db.exec(readFileSync('supabase/migrations/202609050001_create_app_state.sql','utf8'));
  await db.exec('GRANT SELECT,INSERT,UPDATE,DELETE ON public.app_state TO anon,authenticated');
  const sql=readFileSync('supabase/migrations/20261007233000_crm_read_feed.sql','utf8');
  await db.exec(sql);
  // Replay must not remove existing capabilities or data.
  await db.query('INSERT INTO public.app_state(user_id,data) VALUES ($1,$2),($3,$4)',[owner,fixture,other,{products:[{id:8,name:'Outra conta',stock:8,apc:1}],clients:[],sales:[]}]);
  await db.exec(`SET ROLE authenticated; SET "request.jwt.claim.sub"='${owner}';`);
  const token=(await db.query('SELECT public.daf_crm_issue_token() AS token')).rows[0].token;
  assert.match(token,/^[a-f0-9]{64}$/);
  await assert.rejects(db.query('SELECT * FROM public.daf_crm_tokens'),/permission denied/);
  await db.exec('RESET ROLE');
  const stored=(await db.query('SELECT token_hash FROM public.daf_crm_tokens WHERE user_id=$1',[owner])).rows[0].token_hash;
  assert.notEqual(stored,token);assert.equal(stored.length,64);
  await db.exec(sql);
  await db.exec(`SET ROLE anon; SET "request.jwt.claim.sub"='';`);
  await assert.rejects(db.query('SELECT public.daf_crm_issue_token()'),/permission denied/);
  assert.equal((await db.query('UPDATE public.app_state SET data=$1',[{}])).affectedRows,0);
  assert.equal((await db.query('SELECT * FROM public.app_state')).rows.length,0);
  await assert.rejects(db.query("SELECT public.daf_crm_feed($1, 'daf-crm-feed-v2')", ['x']),/Invalid read/);
  await assert.rejects(db.query('SELECT public.daf_crm_feed($1)',[token]),/permission denied/);
  await assert.rejects(db.query('SELECT public.daf_crm_feed($1,$2)',[token,'daf-crm-feed-v1']),/contract v2/);
  const feed=(await db.query("SELECT public.daf_crm_feed($1, 'daf-crm-feed-v2') AS feed",[token])).rows[0].feed;
  assert.equal(feed.format,'daf-crm-feed-v2');
  assert.equal(feed.meta.stockModel,'product-bottle-evidence-v1');
  assert.equal(feed.meta.identity,'daf-gestao:'+owner);
  assert.deepEqual(feed.data.products.map(p=>p.id),[7]);
  assert.equal(feed.data.products[0].stock,140); // already net, not 140-60
  assert.deepEqual(feed.data.products[0].bottleHistory,[{number:1,ml:100},{number:2,ml:100}]);
  assert.equal(feed.data.products[0].cost,undefined);
  assert.equal(feed.data.clients[0].cpf,undefined);
  assert.equal(feed.data.sales[0].items[0].unitCost,undefined);
  const js=crmProjection(fixture);
  assert.deepEqual(js.products.map(p=>({id:p.id,stock:p.stock,bottleNumber:p.bottleNumber,bottleHistory:p.bottleHistory})),feed.data.products.map(p=>({id:p.id,stock:p.stock,bottleNumber:p.bottleNumber,bottleHistory:p.bottleHistory})));
  await db.exec(`SET ROLE authenticated; SET "request.jwt.claim.sub"='${other}';`);
  assert.deepEqual((await db.query('SELECT user_id FROM public.app_state')).rows.map(r=>r.user_id),[other]);
  assert.equal((await db.query('UPDATE public.app_state SET data=$1 WHERE user_id=$2',[{},owner])).affectedRows,0);
  await db.query('SELECT public.daf_crm_revoke_token()');
  assert.equal((await db.query("SELECT public.daf_crm_feed($1, 'daf-crm-feed-v2') AS feed",[token])).rows[0].feed.meta.identity,'daf-gestao:'+owner);
  await db.exec(`SET "request.jwt.claim.sub"='${owner}';`);
  const rotated=(await db.query('SELECT public.daf_crm_issue_token() AS token')).rows[0].token;
  assert.notEqual(rotated,token);
  await assert.rejects(db.query("SELECT public.daf_crm_feed($1, 'daf-crm-feed-v2')",[token]),/Invalid read/);
  await db.query('SELECT public.daf_crm_revoke_token()');
  await assert.rejects(db.query("SELECT public.daf_crm_feed($1, 'daf-crm-feed-v2')",[rotated]),/Invalid read/);
 } finally { await db.close(); }
});
