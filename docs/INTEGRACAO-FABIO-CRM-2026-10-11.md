# Integração isolada sobre Fabio — 11/10/2026

Branch `homologacao/fabio-dashboard-crm-20261011`, criada sobre o HEAD conferido de Fabio `fc6d3578132ec94af7fce26f682c84481eb9d24f`. Nenhum merge, deploy ou SQL remoto de escrita está autorizado. `vercel.json` desabilita deployment desta branch e conserva os dois rewrites do catálogo.

## Diff seletivo

App.tsx permanece o arquivo de Fabio, com sua interface, vendas, compras, estoque, insumos, frascos, MandaBem, financeiro e administração. Mudanças: identidade opcional P/C/V; CAS/bootstrap/recuperação de rascunho e polling ocioso; publicação confirmada; acesso ao painel CRM; produtos já identificados deixam de ser agrupados pelo nome. O formulário passa a manter os campos de uma venda existente (incluindo MandaBem) e rejeita seletor de nome ambíguo. Nenhuma reformulação visual.

Catalog.tsx conserva projeção, configurações, renderização e enriquecimento de imagens. Apenas o fallback passa a aceitar o cache de publicação confirmado pela RPC; uma resposta válida sem produtos não reutiliza o antigo rascunho daf-v4. CSS, api/mandabem.js, api/fragrantica-image.js, packaging.ts, report.ts, main.tsx, dependências/lock e assets são preservados.

D0/D1/D2/D3 são cópias byte a byte de PR #17 `2a65401` e D3 `9e2e66f`; não foram reescritas. O aditivo Fabio `20261011035438_fabio_catalog_cas.sql` usa a capacidade privada D3 e a mesma ordem global de locks. Ele adapta historical/prepared ao contrato CRM e adiciona `daf_publish_catalog(expected_revision,items)`: admin Auth obrigatório, revisão e estado compartilhado atuais, projeção de estoque e configurações iguais aos dados persistidos, campos públicos limitados e forma segura das imagens. Não atualiza management/perfumes/links/vendas. Um único slug compartilhado conserva o owner já existente; grants/guard recusam DML externo; leitura publicada também funciona para visitantes autenticados.

A fila avança somente pelas revisões reconhecidas da própria sessão. Conflito 40001 ou gravação de confirmação incerta bloqueiam a fila; não há rebase/retry automático. O rascunho fica separado por usuário, com exportação e recarga explícita. Bootstrap recebe os dados reais do singleton, nunca um snapshot local. O catálogo usa RETURNING e verifica a revisão novamente após carregar imagens. Estado salvo e catálogo ainda não publicado são situações distintas.

## Dependência public_catalogs

Consulta restrita a pg_catalog no projeto da gestão em 11/10: tabela ausente (sem colunas, constraints, policies ou triggers). Nenhuma linha de negócio foi lida ou escrita. O código Fabio espera a migration existente `202610060001_create_public_catalog.sql`: PK user_id/auth.users, slug único, name/published/items/updated_at, itens array, RLS/leitura anon publicada e trigger de timestamp. Essa migration é aplicada somente no runner. O novo aditivo exige sua presença e não cria outra tabela. A presença/forma precisará ser reconferida antes de qualquer futura instalação; não presumir que o catálogo esteja ativo em produção.

## Homologação e correspondência

CRM branch `homologacao/dashboard-feed-20261009`, base `f90b457`. Fixture `tests/fixtures/dashboard-fabio/PROVENANCE.json` fixa o commit deste código e SHA-256/hash Git de cada fonte/SQL. O workflow continua restrito àquela branch CRM, runner Ubuntu 24.04 comum, Node 24.19.0, CLI 2.120.0, duas stacks locais independentes (54321/54322 e 55321/55322), dez serviços reais, dados fictícios e tráfego desligado. As regressões D0-D3 e os seis casos D3 continuam obrigatórios; o gate Fabio é adicional. Os hooks React/FormData são adaptadores explícitos para executar os callbacks originais; backend de sucesso é GoTrue/PostgREST/PostgreSQL real. MandaBem fica sem credenciais e sem chamadas externas.

Este documento antecede a execução real desta revisão. Resultado e run serão registrados no checkpoint do CRM; build/teste local sozinho não é PASS integrado.

## Plano futuro, sujeito a autorização separada

1. Reconferir HEAD de fabio e comparar contra fc6d357. Se avançar, reconciliar as alterações nesta branch, atualizar proveniência e repetir homologação afetada. Promoção bloqueada até isso ocorrer.
2. Rever o diff seletivo com Fabio; confirmar todos os writers autorizados, estrutura dos gatilhos, igualdade dos app_states com management e forma/ausência de public_catalogs por leitura. Concluir QA em dois navegadores para os fluxos operacionais de Fabio; não chamar MandaBem real neste ensaio.
3. Em janela explicitamente autorizada, suspender todos os writers e publicar manutenção; realizar backup recuperável antes de migrations. Não aplicar D3 com estados divergentes, não usar adoção de UUID como reconciliação e não executar a fixture de gatilhos em produção.
4. Aplicar somente migrations ainda ausentes, uma vez e em ordem: schema app_state já existente → migration Fabio public_catalogs (se ausente e estrutura revisada) → D0 → D1 → D2 → D3 → aditivo Fabio. Não reexecutar D0/D1 após D2/D3 nem aplicar código da main antiga.
5. Fazer dry-run e adoção controlada dos UUIDs na revisão observada; provar catálogo/vínculos/estoque/disponibilidade/timestamps e negócio invariantes. Produtos com marca/nome iguais e UUIDs diferentes exigem decisão de identificação antes de lançamento por nome; o guard recusa a operação, sem fundir ou reconciliar dados.
6. Promover apenas o build desta integração reconciliada para a branch realmente publicada, mediante revisão/aprovação separada. Encerrar/recarregar sessões antigas e adaptar writers externos. Durante a mesma manutenção, executar o novo `activate-shared-cas.sql` somente depois desses passos; o antigo activate-cas-only.sql não é usado. Cortar ambos os estados e confirmar os privilégios de colunas/service_role. Ainda não conectar a Vercel ao CRM/dashboard nesta tarefa.
7. Confirmar leitura/bootstrap/CAS/conflito, publicação da revisão persistida e catálogo anon/autenticado; provar saldos nas três representações e consumidor CRM sem segunda baixa. Configurar chave de leitura somente no servidor CRM autorizado, após os gates; manter WhatsApp/executor/Evolution/webhooks desligados. Reabrir gestão só após a validação acordada.
8. Em falha, manter manutenção e suspender sincronização/publicação. Não voltar a writers legados contra CAS ativado nem remover UUIDs/aliases ou refazer descontos. Restaurar snapshot e aplicação juntos somente com plano de restauração autorizado e validado.

Homologação isolada não autoriza instalação operacional. TLS hospedado, Vercel, sessão completa de navegador, Storage, volumes reais e serviço MandaBem externo ficam fora deste ensaio. Cache offline mostra a última publicação e seu timestamp; não promete estoque atual durante indisponibilidade.
