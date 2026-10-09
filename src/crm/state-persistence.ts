/** The dashboard is the only writer. A stale inventory payload is never merged/rebased. */
export type StateClient={rpc:(name:string,args?:Record<string,unknown>)=>PromiseLike<{data:any;error:any}>};
export class StateConflict extends Error {constructor(){super('REVISION_CONFLICT');}}
export async function readState(client:StateClient){
 const {data,error}=await client.rpc('daf_read_app_state');if(error)throw Error(error.message||'STATE_READ_FAILED');
 if(!data||typeof data.revision!=='string'||!/^\d+$/.test(data.revision))throw Error('INVALID_STATE_REVISION');
 return data as {revision:string;data:any;identitiesReady:boolean};
}
/** Explicit first-session bootstrap; read/feed RPCs remain read-only. */
export async function initializeState(client:StateClient){
 const current=await readState(client);if(current.data!==null)return current;
 const {data,error}=await client.rpc('daf_bootstrap_app_state');
 if(error){if(error.code==='40001')throw new StateConflict();throw Error(error.message||'STATE_BOOTSTRAP_FAILED');}
 if(!data||typeof data.revision!=='string'||!/^\d+$/.test(data.revision)||data.data===null)throw Error('INVALID_STATE_BOOTSTRAP');
 return data as {revision:string;data:any;identitiesReady:boolean};
}
export async function saveState(client:StateClient,revision:string,data:unknown){
 const result=await client.rpc('daf_save_app_state',{p_expected_revision:revision,p_data:data});
 if(result.error){if(result.error.code==='40001'||result.error.message?.includes('REVISION_CONFLICT'))throw new StateConflict();throw Error(result.error.message||'STATE_SAVE_FAILED');}
 if(typeof result.data?.revision!=='string'||!/^\d+$/.test(result.data.revision))throw Error('INVALID_STATE_REVISION');
 return result.data as {revision:string;data:any};
}
export function newIdentities<T extends Record<string,any>>(next:T,previous:T):T{
 const result:Record<string,any>={...next};
 for(const kind of ['products','clients','sales']){
  result[kind]=next[kind].map((row:any)=>{const old=previous[kind].find((x:any)=>x.id===row.id);
   return {...row,externalId:row.externalId||old?.externalId||(!old?crypto.randomUUID():undefined)};});
 }
 return result as T;
}
