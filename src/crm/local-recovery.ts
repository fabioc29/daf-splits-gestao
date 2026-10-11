/** Browser recovery is a separate capability from a confirmed database write. */
export function optionalLocalGet(key:string){try{return window.localStorage.getItem(key);}catch{return null;}}
export function optionalLocalSet(key:string,value:string){try{window.localStorage.setItem(key,value);return true;}catch{return false;}}
export function optionalLocalRemove(key:string){try{window.localStorage.removeItem(key);return true;}catch{return false;}}
export type DraftRecord={format:'daf-recovery-v1';userId:string;tabId:string;revision:string;draft:any};
export class LocalRecovery {
 readonly tabId:string;
 readonly key:string;
 private storage:Storage;
 constructor(readonly userId:string){
  this.storage=window.localStorage;
  const session=window.sessionStorage;
  this.tabId=session.getItem('daf-recovery-tab')||crypto.randomUUID();
  session.setItem('daf-recovery-tab',this.tabId);
  this.key=`daf-v4-pending:${userId}:${this.tabId}:${crypto.randomUUID()}`;
  // Probe writes as well as reads. Denied access/quota must block edits before accepting them.
  const probe=this.key+':probe';this.storage.setItem(probe,'1');if(this.storage.getItem(probe)!=='1')throw Error('LOCAL_STORAGE_UNREADABLE');this.storage.removeItem(probe);
 }
 list():DraftRecord[]{
  const records:DraftRecord[]=[];
  for(let i=0;i<this.storage.length;i++){
   const key=this.storage.key(i);
   if(!key||(key!==`daf-v4-pending:${this.userId}`&&!key.startsWith(`daf-v4-pending:${this.userId}:`))||key.endsWith(':probe'))continue;
   const raw=this.storage.getItem(key);if(!raw)continue;
   const value=JSON.parse(raw);
   const record=value?.format==='daf-recovery-v1'?value:{format:'daf-recovery-v1',userId:this.userId,tabId:'legacy',revision:'unknown',draft:value};
   if(record.userId!==this.userId||!record.draft||typeof record.draft!=='object')throw Error('INVALID_LOCAL_DRAFT');
   records.push(record);
  }
  return records;
 }
 preserve(draft:any,revision:string){
  const value:DraftRecord={format:'daf-recovery-v1',userId:this.userId,tabId:this.tabId,revision,draft};
  const encoded=JSON.stringify(value);this.storage.setItem(this.key,encoded);
  if(this.storage.getItem(this.key)!==encoded)throw Error('LOCAL_DRAFT_NOT_DURABLE');
 }
 clear(){this.storage.removeItem(this.key);}
}
