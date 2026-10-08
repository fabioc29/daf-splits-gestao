/** Minimal read-only CRM projection; costs, CPF and financial accounts stay in Gestão. */
export function crmProjection(data:any){
 return {
  products:(data.products||[]).map((p:any)=>({id:p.id,externalId:p.externalId??null,legacyIds:p.legacyIds||[p.id],name:p.name,brand:p.brand,category:p.category,gender:p.gender??null,stock:p.stock,apc:p.apc,bottleNumber:p.bottleNumber??null,bottleHistory:(p.bottleHistory||[]).map((b:any)=>({number:b.number,ml:b.ml??null}))})),
  clients:(data.clients||[]).map((c:any)=>({id:c.id,externalId:c.externalId??null,legacyIds:c.legacyIds||[c.id],cep:c.cep??null,name:c.name,phone:c.phone,date:c.date??null,addresses:c.addresses||[]})),
  sales:(data.sales||[]).map((v:any)=>({id:v.id,externalId:v.externalId??null,legacyIds:v.legacyIds||[v.id],payment:v.payment??null,historicalReceivable:!!v.historicalReceivable,preparationTracked:!!v.preparationTracked,clientId:v.clientId,clientExternalId:(data.clients||[]).find((c:any)=>c.id===v.clientId)?.externalId??null,date:v.date,total:v.total,paid:v.paid,status:v.status||'active',prepared:!!v.prepared,sent:!!v.sent,channel:v.channel||'direct',marketplace:v.marketplace??null,customerName:v.customerName??null,items:(v.items||[]).map((i:any)=>({productId:i.productId,productExternalId:(data.products||[]).find((p:any)=>p.id===i.productId)?.externalId??null,ml:i.ml,isApc:!!i.isApc}))}))
 };
}
