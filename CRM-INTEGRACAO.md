# Integração de leitura DAF → CRM

Esta atualização acrescenta a tela **Integração CRM**. Ela exporta uma projeção mínima em JSON e permite emitir/revogar uma chave de consulta. Não modifica regras de estoque nem grava dados vindos do CRM.

## Ativação

1. Aplicar `supabase/migrations/20261007233000_crm_read_feed.sql` no projeto Supabase que já armazena a gestão. Não executado automaticamente por este PR.
2. Publicar a atualização do dashboard e entrar com a conta que mantém os dados da empresa. A tabela atual `app_state` é vinculada a `auth.uid()`; a chave consulta somente a base dessa conta.
3. Em **Integração CRM**, gerar a chave. Uma nova chave revoga a anterior. Não enviar a chave pelo chat, commits, capturas de tela ou grupos.
4. Configurar no servidor privado do CRM: `DAF_DASHBOARD_URL`, `DAF_DASHBOARD_ANON_KEY` (chave publicável do mesmo projeto) e `DAF_DASHBOARD_READ_TOKEN` (chave gerada). Segredos ficam fora do navegador e do repositório.
5. No CRM, abrir **Integrações → Sincronizar agora**. Conferir lotes, saldo e revisão. Registrar uma venda fictícia apenas em uma base de teste e confirmar a atualização da copy.

## Contrato

`POST /rest/v1/rpc/daf_crm_feed`, cabeçalho `apikey` com a chave publicável do projeto, corpo `{ "p_token": "<chave de leitura>", "p_contract_version": "daf-crm-feed-v2" }`. A função não aceita usuário de destino nem caminhos de escrita. O proprietário é resolvido a partir do hash da chave. A leitura retorna `format`, `meta.identity`, `meta.revision`, `meta.exportedAt` e `data` com produtos, clientes e vendas.

`stock` já é o volume disponível; o CRM nunca subtrai as vendas novamente. IDs de produto representam lotes e não são reunidos por nome. `apc` é 0 ou 1 frasco. Vendas canceladas permanecem identificadas no histórico. Preço de custo, margem, CPF, suprimentos, despesas e recebíveis financeiros ficam fora da projeção. Nome, telefone e endereço de entrega continuam sendo dados pessoais e o arquivo deve permanecer em acesso restrito.

## Segurança e reversão

Tokens com 64 caracteres hexadecimais de alta entropia; apenas o hash SHA-256 é persistido. A tabela de tokens tem RLS habilitada e nenhum acesso direto de `anon`/`authenticated`. Somente a função autenticada de emissão/revogação pode gerenciar a chave da própria conta. Funções definidoras têm `search_path` vazio. RLS e grants de `app_state` são preservados.

Para interromper a integração, usar **Revogar acesso** no dashboard. O CRM preserva sua última leitura e passa a bloquear operações que exigem sincronização atual. Para remover a mudança visual, reverter este PR. A migração não destrói nem transforma registros existentes.

## Verificação

O código original de `src/App.tsx` foi comparado por SHA com o repositório antes da edição. As mudanças de interface são aditivas. A migração requer validação de execução no projeto Supabase; não foi aplicada ao banco real nesta revisão. O CRM possui testes para saldo sem dupla baixa, lotes separados, chaves de origem, revisões antigas, estoque zerado e copies dinâmicas.

## Consolidação de 7 de outubro

O feed agora é `daf-crm-feed-v2`, com `meta.stockModel=product-bottle-evidence-v1` e evidência mínima de `bottleNumber`/`bottleHistory` (número e volume original). O CRM rejeita o feed v1 para envio conectado, pois ele omite a agregação de frascos da branch `fabio`. Saldo agregado continua visível, mas não autoriza anunciar um lote/APC específico. Não se inventa a distribuição dos ml entre frascos.

O identificador da migração foi alterado para não colidir com `202610060001_create_public_catalog.sql` existente em `fabio`. A função continua somente de leitura. Se o SQL antigo tiver sido aplicado em outro ambiente, a nova migração substitui as funções sem apagar a tabela ou as chaves existentes. Nenhuma migração de produção foi executada nesta revisão.

## Verificação reproduzível

Com Node compatível com a execução de TypeScript nativo e as dependências do lockfile: `npm ci`, `npm run test:crm`, `npm run typecheck`, `npm run typecheck:crm`, `npm run build`. `test:crm` usa PostgreSQL local em memória (PGlite); não utiliza URL, token ou dados de produção. A opção de resolução Bundler no script de tipos é compatível com o Vite e evita a opção Node antiga removida na versão do TypeScript registrada no lockfile. Nenhuma dependência de execução mudou de versão.

A main foi verificada antes e depois da revisão. O trabalho recente de Fábio está na branch `fabio`, não na main. Antes de integrar com ela, consulte `CRM-CHECKPOINT.md` e o patch de quatro linhas para seu App.tsx. Não substitua seu App.tsx pelo arquivo desta branch.

O pedido à API exige `p_contract_version=daf-crm-feed-v2`. A assinatura antiga com apenas token é preservada, mas seu acesso é revogado e ela rejeita a operação: isso impede o CRM antigo de consumir silenciosamente dados cujo histórico de frascos ele ignora. Na ativação, publicar primeiro o CRM consolidado com envios desabilitados; configurar a leitura e verificar os bloqueios antes de qualquer pareamento/envio autorizado.

## Finalização de 8/10 — branch oficial e lotes não comprovados

A branch oficial para esta integração é `crm/read-only-feed-20261006`, PR #17 sobre main. O acompanhamento de fabio mencionado acima pertence ao checkpoint histórico; não é uma ação pendente desta entrega. A main continua em `0ffcfd65edf9141f44c0fd31c1370b226438bf9c`.

A própria main soma novas compras a um produto encontrado por marca/nome, sem guardar evidência de cada frasco. Portanto, ausência de bottleHistory não comprova um lote. O consumidor consolidado marca o saldo como não validado, mantendo-o visível e bloqueando copies/APC. Só evidencia explícita de um único frasco com volume válido autoriza esse uso. Não preencher histórico fictício nem repartir ml por inferência. A modelagem autoritativa por lote é desenvolvimento pendente; uma chave de leitura não a substitui.

A tela de integração distingue carregamento, função ausente, autorização, base vazia e resposta de rede incerta. Operações de token com resposta perdida devem ser conferidas antes de repetir. O CRM que acompanha a PR foi consolidado com tráfego real de saída e entrada desabilitado. Consulte `CRM-VALIDACAO-2026-10-08.md` para testes, preview, pendências e limites de revisão.
