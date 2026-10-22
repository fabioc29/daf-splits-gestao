/** Browser recovery is a separate capability from a confirmed database write. */
export function optionalLocalGet(key:string){try{return window.localStorage.getItem(key);}catch{return null;}}
export function optionalLocalSet(key:string,value:string){try{window.localStorage.setItem(key,value);return true;}catch{return false;}}
export function optionalLocalRemove(key:string){try{window.localStorage.removeItem(key);return true;}catch{return false;}}
export type DraftRecord={format:'daf-recovery-v1';userId:string;tabId:string;revision:string;draft:any;storageKey?:string};

export class LocalRecovery {
 readonly tabId:string;
 readonly key:string;
 private storage:Storage;

 constructor(readonly userId:string){
  this.storage=window.localStorage;
  const session=window.sessionStorage;
  this.tabId=session.getItem('daf-recovery-tab')||crypto.randomUUID();
  session.setItem('daf-recovery-tab',this.tabId);

  // Use one stable recovery key per browser tab. The previous implementation
  // generated a new UUID on every page load, leaving orphan recovery records
  // behind forever and causing the "rascunhos locais pendentes" banner to
  // reappear even after the user chose to load the confirmed server state.
  this.key=`daf-v4-pending:${userId}:${this.tabId}`;

  // Probe writes as well as reads. Denied access/quota must block edits before accepting them.
  const probe=this.key+':probe';
  this.storage.setItem(probe,'1');
  if(this.storage.getItem(probe)!=='1')throw Error('LOCAL_STORAGE_UNREADABLE');
  this.storage.removeItem(probe);
 }

 private belongsToUser(key:string){
  return key===`daf-v4-pending:${this.userId}`||
    key.startsWith(`daf-v4-pending:${this.userId}:`);
 }

 private readRecord(key:string):DraftRecord|null{
  if(!this.belongsToUser(key)||key.endsWith(':probe'))return null;
  const raw=this.storage.getItem(key);
  if(!raw)return null;
  const value=JSON.parse(raw);
  const record:DraftRecord=value?.format==='daf-recovery-v1'
    ? value
    : {format:'daf-recovery-v1',userId:this.userId,tabId:'legacy',revision:'unknown',draft:value};
  if(record.userId!==this.userId||!record.draft||typeof record.draft!=='object')
    throw Error('INVALID_LOCAL_DRAFT');
  return {...record,storageKey:key};
 }

 list():DraftRecord[]{
  const records:DraftRecord[]=[];
  for(let i=0;i<this.storage.length;i++){
   const key=this.storage.key(i);
   if(!key)continue;
   const record=this.readRecord(key);
   if(record)records.push(record);
  }
  return records;
 }

 preserve(draft:any,revision:string){
  const value:DraftRecord={format:'daf-recovery-v1',userId:this.userId,tabId:this.tabId,revision,draft};
  const encoded=JSON.stringify(value);
  this.storage.setItem(this.key,encoded);
  if(this.storage.getItem(this.key)!==encoded)throw Error('LOCAL_DRAFT_NOT_DURABLE');
 }

 remove(record:DraftRecord){
  if(record.storageKey&&this.belongsToUser(record.storageKey)){
   this.storage.removeItem(record.storageKey);
  }
 }

 clear(){
  // Clear every historical key belonging to this same browser tab, including
  // keys created by the old random-key implementation.
  const keys:string[]=[];
  for(let i=0;i<this.storage.length;i++){
   const key=this.storage.key(i);
   if(!key||!this.belongsToUser(key)||key.endsWith(':probe'))continue;
   try{
    const record=this.readRecord(key);
    if(key===this.key||record?.tabId===this.tabId)keys.push(key);
   }catch{
    // Leave malformed records for explicit recovery rather than deleting silently.
   }
  }
  keys.forEach((key)=>this.storage.removeItem(key));
 }

 clearAll(){
  // Used only after the user explicitly confirms "Carregar estado salvo".
  const keys:string[]=[];
  for(let i=0;i<this.storage.length;i++){
   const key=this.storage.key(i);
   if(key&&this.belongsToUser(key)&&!key.endsWith(':probe'))keys.push(key);
  }
  keys.forEach((key)=>this.storage.removeItem(key));
 }
}
