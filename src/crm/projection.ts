/** Minimal read-only CRM projection; costs, CPF and financial accounts stay in Gestão. */
export function crmProjection(data:any){
 return {
  products:(data.products||[]).map((p:any)=>({id:p.id,name:p.name,brand:p.brand,category:p.category,gender:p.gender,stock:p.stock,apc:p.apc,bottleNumber:p.bottleNumber??null,bottleHistory:(p.bottleHistory||[]).map((b:any)=>({number:b.number,ml:b.ml??null}))})),
  clients:(data.clients||[]).map((c:any)=>({id:c.id,name:c.name,phone:c.phone,date:c.date,addresses:c.addresses||[]})),
  sales:(data.sales||[]).map((v:any)=>({id:v.id,clientId:v.clientId,date:v.date,total:v.total,paid:v.paid,status:v.status||'active',prepared:!!v.prepared,sent:!!v.sent,channel:v.channel||'direct',marketplace:v.marketplace||'',customerName:v.customerName||'',items:(v.items||[]).map((i:any)=>({productId:i.productId,ml:i.ml,isApc:!!i.isApc}))}))
 };
}
