import {useState} from 'react';
import {supabase} from '../supabase';
import {crmProjection} from './projection';
import {feedErrorMessage} from './feed-status';
type Action = 'export' | 'issue' | 'revoke';
export function CRMFeedPanel({userId,synced}:{userId:string;synced:boolean}) {
 const [token,setToken]=useState(''), [busy,setBusy]=useState<Action|null>(null);
 const [notice,setNotice]=useState(''), [failed,setFailed]=useState(false), [confirm,setConfirm]=useState(false);
 async function run(action:Action) {
  if(busy)return;
  setBusy(action);setNotice('');setFailed(false);
  if(action!=='export')setToken('');
  try {
   if(action==='export') {
    const {data:row,error}=await supabase.from('app_state').select('data,updated_at').eq('user_id',userId).single();
    if(error)throw error;
    const content={format:'daf-crm-feed-v2',meta:{identity:'daf-gestao:'+userId,revision:row.updated_at,exportedAt:new Date().toISOString(),stockModel:'product-bottle-evidence-v1'},data:crmProjection(row.data)};
    const url=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='DAF-gestao-para-CRM.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    setNotice('Exportação v2 da última versão salva concluída.');
   } else {
    const {data,error}=await supabase.rpc(action==='issue'?'daf_crm_issue_token':'daf_crm_revoke_token');
    if(error)throw error;
    if(action==='issue' && (typeof data!=='string'||!/^[a-f0-9]{64}$/.test(data)))throw Error('Resposta inválida');
    setToken(action==='issue'?data:'');setConfirm(false);
    setNotice(action==='issue'?'Chave criada. Configure somente no servidor do CRM. A chave anterior foi revogada.':'Acesso de leitura revogado.');
   }
  } catch(error) {
   setFailed(true);setNotice(feedErrorMessage(error as {code?:string},action));
  } finally {setBusy(null);}
 }
 return <section className="card" aria-busy={!!busy}>
  <h2>Dashboard → CRM DAF</h2>
  <p>O CRM consulta saldo, evidência de frascos, contatos e compras. Esta integração não altera produtos, pedidos nem estoque da gestão.</p>
  <p>CPF, custos, despesas e contas financeiras ficam fora. Nome, telefone e endereço de entrega continuam privados.</p>
  <p role="note"><b>Validação de lotes/APC:</b> esta versão da gestão pode somar novas compras ao mesmo perfume. Sem evidência de um único frasco, o CRM mostra o saldo, mas bloqueia sua divulgação e seu APC. Exportar ou gerar uma chave não resolve essa falta de informação.</p>
  <button className="primary" disabled={!!busy||!synced} onClick={()=>run('export')}>{busy==='export'?'Exportando…':'Exportar JSON v2 para o CRM'}</button>
  {!synced&&<p role="status">Aguarde os dados serem salvos na nuvem antes de exportar.</p>}
  <hr/><h3>Conexão de leitura automática</h3>
  <p>Após instalar a função no banco autorizado, gere uma chave exclusiva para o CRM. Ela aparece somente nesta sessão e deve ficar no servidor.</p>
  <button disabled={!!busy} onClick={()=>setConfirm(true)}>Criar / substituir chave de leitura</button>
  <button disabled={!!busy} onClick={()=>{if(window.confirm('Revogar a leitura do CRM? O CRM manterá a última consulta, sem novas atualizações.'))run('revoke');}}>{busy==='revoke'?'Revogando…':'Revogar acesso'}</button>
  {confirm&&<div role="alert"><p>Uma nova chave invalida a anterior. Continuar?</p><button disabled={!!busy||!synced} onClick={()=>run('issue')}>{busy==='issue'?'Gerando…':'Gerar chave'}</button><button disabled={!!busy} onClick={()=>setConfirm(false)}>Cancelar</button></div>}
  {token&&<label>Chave exibida somente nesta sessão<input type="password" value={token} readOnly autoComplete="off" spellCheck={false}/><button onClick={async()=>{try{await navigator.clipboard.writeText(token);setFailed(false);setNotice('Chave copiada.');}catch{setFailed(true);setNotice('Não foi possível copiar. Selecione a chave no campo.');}}}>Copiar chave</button><button onClick={()=>setToken('')}>Ocultar e limpar</button></label>}
  {notice&&<p role={failed?'alert':'status'}>{notice}</p>}
 </section>;
}
