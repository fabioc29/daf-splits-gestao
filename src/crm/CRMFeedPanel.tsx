import {useState} from 'react';
import {supabase} from '../supabase';
import {crmProjection} from './projection';
export function CRMFeedPanel({userId,synced}:{userId:string;synced:boolean}){
 const [token,setToken]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[confirm,setConfirm]=useState(false);
 async function run(action:'export'|'issue'|'revoke'){
  setBusy(true);setNotice('');
  try{
   if(action==='export'){
    const {data:row,error}=await supabase.from('app_state').select('data,updated_at').eq('user_id',userId).single();
    if(error)throw error;
    const content={format:'daf-crm-feed-v2',meta:{identity:'daf-gestao:'+userId,revision:row.updated_at,exportedAt:new Date().toISOString(),stockModel:'product-bottle-evidence-v1'},data:crmProjection(row.data)};
    const url=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='DAF-gestao-para-CRM.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Exportação da última versão salva concluída.');
   }else{
    const {data,error}=await supabase.rpc(action==='issue'?'daf_crm_issue_token':'daf_crm_revoke_token');
    if(error)throw Error('A integração ainda não foi instalada no banco. Aplique a migração de leitura do CRM.');
    setToken(action==='issue'?data:'');setConfirm(false);setNotice(action==='issue'?'Chave criada. Copie e configure somente no servidor do CRM. A chave anterior deixou de funcionar.':'Acesso de leitura revogado.');
   }
  }catch(e){setNotice((e as Error).message);}finally{setBusy(false);}
 }
 return <section className="card"><h2>Dashboard → CRM DAF</h2><p>O CRM consulta estoque, disponibilidade de APC, contatos e histórico de compras. A integração não pode alterar produtos, pedidos nem saldos desta gestão.</p><p>Dados exportados: lotes, saldo atual em ml, nome e telefone dos clientes, endereço de entrega e itens comprados. CPF, custos, despesas e dados financeiros internos ficam fora.</p><button className="primary" disabled={busy||!synced} onClick={()=>run('export')}>Exportar JSON para o CRM</button>{!synced&&<p>Aguarde os dados serem salvos na nuvem antes de exportar.</p>}<hr/><h3>Conexão de leitura automática</h3><p>Após instalar a função de leitura no banco, gere uma chave exclusiva para o CRM. Ela será mostrada somente nesta tela e deve ficar no servidor, nunca em um grupo ou repositório.</p><button disabled={busy} onClick={()=>setConfirm(true)}>Criar / substituir chave de leitura</button><button disabled={busy} onClick={()=>{if(window.confirm('Revogar a conexão de leitura do CRM? O CRM manterá apenas a última consulta, sem novas atualizações.'))run('revoke');}}>Revogar acesso</button>{confirm&&<div role="alert"><p>Gerar uma nova chave invalida a anterior. Continuar?</p><button disabled={busy} onClick={()=>run('issue')}>Gerar chave</button><button onClick={()=>setConfirm(false)}>Cancelar</button></div>}{token&&<label>Chave exibida somente nesta sessão<input type="password" value={token} readOnly autoComplete="off"/><button onClick={async()=>{try{await navigator.clipboard.writeText(token);setNotice('Chave copiada.');}catch{setNotice('Não foi possível copiar. Selecione a chave no campo.');}}}>Copiar chave</button><button onClick={()=>setToken('')}>Ocultar e limpar</button></label>}{notice&&<p role="status">{notice}</p>}</section>;
}
