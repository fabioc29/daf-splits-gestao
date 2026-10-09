import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeState,readState,StateConflict} from '../src/crm/state-persistence.ts';
test('first session bootstraps the persisted shared snapshot without submitting a local stock draft',async()=>{
 const calls=[];const shared={revision:'9007199254740993',data:{products:[{stock:27}],clients:[],sales:[]},identitiesReady:true};
 const client={rpc:async(name,args)=>{calls.push({name,args});return {error:null,data:name==='daf_read_app_state'?{revision:'0',data:null,identitiesReady:true}:shared};}};
 assert.deepEqual(await initializeState(client),shared);
 assert.deepEqual(calls,[{name:'daf_read_app_state',args:undefined},{name:'daf_bootstrap_app_state',args:undefined}]);
});
test('existing sessions and periodic read remain read-only; bootstrap conflict never acknowledges a draft',async()=>{
 const calls=[];const state={revision:'4',data:{products:[],clients:[],sales:[]},identitiesReady:true};
 const client={rpc:async name=>{calls.push(name);return {data:state,error:null};}};
 assert.deepEqual(await initializeState(client),state);assert.deepEqual(await readState(client),state);
 assert.deepEqual(calls,['daf_read_app_state','daf_read_app_state']);
 await assert.rejects(initializeState({rpc:async name=>name==='daf_read_app_state'?{data:{revision:'0',data:null},error:null}:{data:null,error:{code:'40001'}}}),StateConflict);
});
