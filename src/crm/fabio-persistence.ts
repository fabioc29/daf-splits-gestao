import {initializeState,newIdentities,saveState,StateConflict,type StateClient} from './state-persistence';

export type Snapshot={revision:string;data:any;identitiesReady:boolean};
export type CatalogBuilder=(persisted:any)=>Promise<unknown[]>;
export type Publication={status:'published'|'stale'|'error';data?:any;error?:any};
/** Serializes only this tab's acknowledged CAS writes. Never rebases an external conflict. */
export class FabioStateWriter {
 private queue:Promise<unknown>=Promise.resolve();
 private stopped=false;
 blocked=false;
 pending=0;
 constructor(private client:StateClient,public snapshot:Snapshot,private catalog:CatalogBuilder){}
 static async open(client:StateClient,catalog:CatalogBuilder){return new FabioStateWriter(client,await initializeState(client),catalog);}
 dispose(){this.stopped=true;}
 async publish(snapshot:Snapshot=this.snapshot):Promise<Publication>{
  try{
   const items=await this.catalog(snapshot.data);
   if(this.stopped)throw Error('STATE_WRITER_CLOSED');
   const {data,error}=await this.client.rpc('daf_publish_catalog',{p_expected_revision:snapshot.revision,p_items:items});
   if(error)return {status:error.code==='40001'?'stale':'error',error};
   if(!data||data.revision!==snapshot.revision||data.published!==true)throw Error('INVALID_CATALOG_ACK');
   return {status:'published',data};
  }catch(error){return {status:'error',error};}
 }
 save(draft:any){
  const payload=structuredClone(draft);this.pending++;
  const task=this.queue.catch(()=>undefined).then(async()=>{
   if(this.stopped)throw Error('STATE_WRITER_CLOSED');
   if(this.blocked)throw new StateConflict();
   if(!this.snapshot.identitiesReady)throw Error('IDENTITIES_ADOPTION_REQUIRED');
   let saved;
   try{saved=await saveState(this.client,this.snapshot.revision,newIdentities(payload,this.snapshot.data));}
   catch(error){this.blocked=true;throw error;}
   if(!saved.data||typeof saved.data!=='object'){this.blocked=true;throw Error('INVALID_PERSISTED_STATE');}
   this.snapshot={...saved,identitiesReady:true};
   // The builder receives RETURNING data, never the submitted draft.
   const publication=await this.publish(this.snapshot);
   return {saved,publication};
  }).finally(()=>{this.pending--;});
  this.queue=task;return task;
 }
}

export const PUBLISHED_CATALOG_KEY='daf-v4-published-catalog';
export function committedCatalogCache(publication:Publication){
 if(publication.status!=='published')return null;
 const data=publication.data;
 if(!Array.isArray(data?.items)||!/^\d+$/.test(data?.revision)||typeof data?.updatedAt!=='string')return null;
 return JSON.stringify({format:'daf-public-catalog-committed-v1',items:data.items,updatedAt:data.updatedAt});
}
export function readCommittedCatalogCache(serialized:string|null){
 try{const value=JSON.parse(serialized||'null');return value?.format==='daf-public-catalog-committed-v1'&&Array.isArray(value.items)?value:null;}catch{return null;}
}
