# CHECKPOINT — Fabio + integração CRM + D3 — 11/10/2026

**PASS integrado isolado. Rollout operacional não autorizado nem executado.** Dois Supabases descartáveis realmente executaram GoTrue, PostgREST e PostgreSQL; nenhum PASS foi inferido apenas de testes locais. Esta etapa adapta a versão publicada de Fabio, sem substituir seu App.tsx pelo arquivo da main antiga.

## Referências e HEAD conferido

| Item | Referência |
| --- | --- |
| Dashboard | fabioc29/daf-splits-gestao |
| Fabio no início e na conclusão | **fc6d3578132ec94af7fce26f682c84481eb9d24f** |
| Nova branch isolada | homologacao/fabio-dashboard-crm-20261011 |
| Guard de deploy, pai exatamente fc6d357 | c63c17c65b782ed670a986d6b27e6c1fe5bce407 |
| Adaptação seletiva | fd64d120d3685465efcac450cf9c1dff7d353ed7 |
| Dashboard efetivamente testado | **e884e45efa121d32bd010b5fdf4dc3c6908bde7f** |
| PR #17 / branch, intacta | crm/read-only-feed-20261006 / 2a65401b66ffc2d15adf2c82ecff3fb310d1a1dd |
| D3 homologada original, intacta | homologacao/d3-shared-cas-20261009 / 9e2e66f37f8b3a63de81e2d075576e34f2f4eddb |
| CRM base checkpoint | f90b4574de2a2af79f92082be2a79be8cbe2b027 |
| CRM primeiro ensaio | 1efba224340567c5cf525098f6c695ffcc2d3956 |
| CRM aprovado | **56e504947b7f30f1a619a245df38270e28096fee** |
| Branch CRM | homologacao/dashboard-feed-20261009 |
| Run aprovado / attempt / job | **38111683558 / 1 / 114388389836** |
| GitHub conclusion | **success**, inclusive cleanup e upload |
| Janela UTC / Brasília | 04:28:21–04:32:03 / 01:28:21–01:32:03, 11/10/2026 |
| Artifact aprovado | 11691434212, daf-real-isolated-38111683558-1, ZIP 32.275 bytes |
| ZIP SHA-256 conferido | 20aeecc445678a9124918884df4fb5acf2904073757898f1f1da9819e8472ade |

[Actions aprovado](https://github.com/Gabriel-GR1/daf-crm/actions/runs/38111683558).
[Diff revisável contra Fabio](https://github.com/fabioc29/daf-splits-gestao/compare/fc6d3578132ec94af7fce26f682c84481eb9d24f...e884e45efa121d32bd010b5fdf4dc3c6908bde7f).
[Fontes testadas](https://github.com/fabioc29/daf-splits-gestao/commit/e884e45efa121d32bd010b5fdf4dc3c6908bde7f).
[Proveniência das 33 fontes/SQL](https://github.com/Gabriel-GR1/daf-crm/blob/56e504947b7f30f1a619a245df38270e28096fee/daf-crm/tests/fixtures/dashboard-fabio/PROVENANCE.json).

Fabio não avançou entre as conferências. Se avançar depois deste registro, a promoção fica bloqueada até comparar/reconciliar o delta e repetir os testes afetados. Os commits de checkpoint posteriores aos SHAs acima contêm somente documentação/evidências; não modificam as fontes efetivamente testadas nem disparam outro ensaio.

## Adaptação feita sobre o arquivo de Fabio

Diff contra fc6d357: App.tsx +137/−77 linhas em um arquivo com mais de 11 mil linhas; Catalog.tsx +10/−15. Os componentes/fluxos de vendas, preparo, envio, compras, estoque, frascos, financeiro, fornecedores, interface e administração foram mantidos. Form preserva os campos da venda editada (incluindo MandaBem) e recusa nomes ambíguos; normalização deixa de fundir produtos já identificados por UUID. CSS, packaging.ts, report.ts, main.tsx, api/mandabem.js, api/fragrantica-image.js, package.json/lock e os assets originais conservam seus blobs de Fabio. Não houve reformulação visual.

O salvamento direto em app_state e o upsert direto em public_catalogs saíram do autosave. A sessão faz read/bootstrap sem payload local e usa fila CAS, avançando somente pela revisão de sua própria confirmação. Conflito 40001 ou confirmação incerta bloqueiam a fila: rascunho fica separado por usuário, com exportação/recarga explícita, sem rebase/retry automático. Poll ocioso nunca substitui um rascunho iniciado durante a leitura. A sessão é descartada no logout/troca de usuário.

O catálogo é construído a partir do RETURNING, e daf_publish_catalog verifica novamente revisão + estado compartilhado, depois do enriquecimento das imagens. Rejeita snapshot antigo, estoque/itens/configurações divergentes e campos/formas inseguros. Um slug compartilhado conserva o owner existente e funciona para visitantes anon/autenticados. DML externo do catálogo é fechado. Há publicação explícita da revisão salva; falha de publicação é apresentada separadamente da gravação administrativa. Fallback aceita somente cache de publicação confirmado, com timestamp; resposta válida sem itens não ressuscita rascunho local.

D0/D1/D2/D3 permanecem byte a byte iguais aos originais. O aditivo Fabio foi criado pelo CLI como **20261011035438_fabio_catalog_cas.sql**, SHA-256 **970c74181cb12645c6946c383ef1c482dd3569a5343c686679b9a7e233a37bd6**, Git blob **da1679f9644c51860afa2d7eb6ad3b0e79a71510**. Ele reutiliza capacidade privada e lock global D3; não escreve management/perfumes/links/vendas na publicação. Adapta historical/prepared de Fabio aos indicadores historicalReceivable/preparationTracked do feed, sem mudar o formato v2 ou o consumidor operacional CRM.

O vercel.json contém git.deploymentEnabled para esta branch = false, desde o primeiro commit, mantendo os rewrites /catalogo. A configuração segue a [documentação oficial Vercel](https://vercel.com/docs/project-configuration/git-configuration). Não foram criados previews/deploys manualmente nem alteradas configurações do projeto. A conexão Vercel disponível não retornou projeto alvo/equipes; inspeção externa dos deployments do projeto não pôde ser concluída. O endpoint de deployments no conector GitHub também não é permitido. Não tratar ausência de commit statuses como prova de ausência de deploy; o bloqueio configurado é a evidência disponível.

## public_catalogs — dependência ainda ausente na gestão real

Uma única consulta restrita a pg_catalog no projeto wcsiyqhuofygyajbztjk confirmou table=null, columns=[], constraints=[], policies=[], triggers=[]. Nenhuma linha de negócio foi coletada e não houve SQL de escrita. Evidência em tests/fixtures/dashboard-fabio/PUBLIC-CATALOG-METADATA.json.

A estrutura esperada vem da própria migration Fabio 202610060001_create_public_catalog.sql: PK user_id/FK auth.users, slug NOT NULL UNIQUE, name, published, items jsonb array, updated_at, RLS, grants explícitos e trigger de timestamp. Ela foi aplicada somente no runner. O aditivo exige a tabela; não inventa outra estrutura nem cria/altera tabela real nesta tarefa. Instalação e publicação reais continuam pendentes de autorização e nova conferência de estrutura.

## Serviços, isolamento e verificações

Runner Ubuntu 24.04 comum; duas redes Docker e dez containers reais (PostgreSQL, GoTrue, PostgREST, Kong, Storage em cada stack). Bindings exclusivamente loopback: gestão 54321/54322 e CRM 55321/55322. Sem Docker no Work ou no computador do usuário. Sem projetos Supabase remotos, serviço contratado, runner maior, matriz, schedule, dispatch ou credenciais reais no workflow.

| Componente | Versão observada |
| --- | --- |
| Node / Supabase CLI / Docker | 24.19.0 / 2.120.0 / 28.0.4 |
| PostgreSQL ambos | 17.11, imagem 17.11.0.004 |
| GoTrue / PostgREST | v2.197.0 / v16.4 |
| Kong / Storage bootstrap | 2.8.1 / v1.79.36 |

Ledger gestão exato: schema app_state → migration Fabio public_catalogs → fixture descartável da cadeia compartilhada → D0 → D1 → D2 → D3 → aditivo Fabio. CRM: somente as quatro migrations anteriores. A fixture de gatilhos nunca é destinada à produção. Todas as migrations/fontes vendorizadas foram conferidas contra blobs remotos e por SHA-256/hash Git no runner; D3 conserva 75a83bed2463a9aefe39b23df05b08b266162890b1f4282c746719fe1fcce834. Os quatro assets binários são herdados da árvore Fabio e não duplicados na fixture de build.

**24/24 testes focados, zero falhas/skips; typecheck e build configurado aprovados**, com dependências/lock originais de Fabio e tipos do CRM apenas no ambiente de teste. Build usa Vite URL loopback/chave deliberadamente fictícia e confirma que a gestão, CAS/bootstrap e guard do catálogo estão no bundle; um build com configuração vazia retiraria System por estar inacessível. Os hooks React/FormData são adaptadores explícitos para executar callbacks reais da fonte; sucesso de backend foi demonstrado por HTTP real, não por mock. Não houve ensaio em dois navegadores ou QA visual completo.

O verificador core anterior passou integralmente: GoTrue, RLS/permissões, token/rotação/revogação, feed v2, CAS, sync condicional, UUIDs/aliases, SOURCE_IDENTITIES_LOST, dedupe, 44→27, APC/estoque agregado e preservação de cache. D3: 11 checks PASS, incluindo os seis casos obrigatórios abaixo. O gate histórico BLOCKED e sua evidência antiga continuam intactos.

| Caso D3 | Resultado real |
| --- | --- |
| Deadlock entre admins | PASS: seis schedules, um vencedor e 40001 em cada um; zero 40P01. |
| Escrita direta management | PASS: auth/service e writer legado/spoof recusados 42501; revisão/estado/catalog/cache invariantes. |
| Writer app_state legado | PASS após corte isolado explícito dos dois estados; DML auth/service e definer recusados; non-admin/anon negados; proteção de perda de IDs mantida. |
| Primeiro save | PASS: sem bootstrap retorna 40001; dois bootstraps idênticos herdam 27; save autorizado 9 retorna/persiste exatamente 9/revisão real. |
| Adoção de UUIDs | PASS: dry-run somente leitura; catálogo, vínculo, estoque, disponibilidade e timestamps preservados, inclusive com vínculo ausente fictício. |
| Renumeração | PASS: mesmo UUID/perfume/vínculo, somente número deslocado, zero perfume novo; colisão/swap/ambiguidade/namespace rejeitados atomicamente. |

## Dez regressões Fabio — HTTP real

| Caso | Evidência PASS |
| --- | --- |
| Bootstrap | Sem payload local; snapshot igual ao management; nenhum build/publicação do rascunho durante open; save sem bootstrap 40001; fixture posterior explícita 44, IDs bigint. |
| Catálogo público | Schema nativo; um slug; owner preservado entre dois admins; leitura anon/autenticada; nenhum CPF/custo/clientes/vendas/MandaBem; publicação idempotente não altera timestamp. |
| Venda/edição | Callback original cria venda de 17 ml, saldo 44→27 em app, management, perfume, catálogo público e CRM; editar não desconta novamente; IDs estáveis; histórico/preparo e sync condicional corretos. |
| MandaBem | Metadados fictícios do envio sobrevivem à edição, CAS e recarga; estoque do outro produto continua 60; zero chamadas à API MandaBem. |
| Publicação atrasada | Admin A confirma 28; B confirma/publica 29 durante as imagens; publicação tardia A retorna 40001 e catálogo permanece 29; restauração fictícia explícita a 27. |
| Concorrência/fila | Dois admins: um vencedor, um conflito controlado; fila perdedora bloqueada, sem rebase; estoque consistente. |
| Forgery/writers/RLS | Cinco snapshots forjados e nove DML diretos recusados; non-admin/anon/service não publicam via RPC; estados/catálogo/timestamps invariantes. |
| UUID/metadados/renumeração | Adoção idempotente não muda catálogo; ID bigint renumerado mantém todas as colunas/timestamps do perfume e mesmo vínculo; aliases compartilhados; 2 produtos/1 cliente/3 vendas sem duplicação; compras preservadas; colisão rejeitada. |
| Cancelar/excluir/comprar/frascos | Cancelamento devolve 17 uma vez (44); excluir cancelada não devolve de novo; CRM observa cancelamento e mantém histórico source-missing após exclusão. Gestão: 2 vendas; CRM: 2 presentes + 1 histórico, 3 IDs distintos. Compra soma 100 uma vez (144), mantém UUID, cria segunda compra/frasco; correção de frasco conserva saldo/compras. Cache só confirmado; tasks/outbox=0. |
| Estoque zero/cache | Todos os saldos zero; snapshot público contém somente envelope, nenhum produto; cache vazio confirmado e rascunho não aceito como publicação; CRM zero; retorno a 144 somente por CAS explícito. |

Também foi provada localmente a rejeição dos seletores de venda/compra quando produtos distintos por UUID têm a mesma marca/nome. Não se usa adoção de UUID para fundir produtos ou reconciliar catálogo: essa ambiguidade precisa de decisão operacional antes de qualquer lançamento por nome.

## Primeiro run falhou e permanece registrado

Run **38111303244**, CRM 1efba22: core e D3 PASS, oito casos Fabio PASS; gate final **FAIL**, 3 != 2 ao contar vendas CRM após exclusão. Artifact 11691398822, 30.343 bytes, digest conferido cd7945088729861cdcc37abfea4a8100982aaa459561ed737e312a66ce5b2184.

Causa confirmada no read-model/SQL existente e por teste adicional: CRM conserva histórico, com present=false e status source-missing. O teste esperava remoção total da linha. A correção 56e5049 mudou apenas verificador/teste: agora exige cancelamento observado, duas vendas presentes, uma ausente, três IDs únicos, canonical ID preservado e restauração de estoque uma única vez. Não removeu a verificação nem alterou código CRM/dashboard para apagar histórico. O segundo run executou todos os serviços e os dez gates; o primeiro não foi reclassificado como PASS.

## Evidências versionadas e limites

No CRM: docs/evidencias/actions-38111303244/ e docs/evidencias/actions-38111683558/ contêm os artifacts sanitizados, JOB-LOG e RUN-METADATA. O aprovado contém 28 arquivos de artifact mais 2 de registro; há também os dois diffs em docs/evidencias/fabio-20261011/. Os ZIPs tiveram SHA-256 conferido. JWTs/chaves/senhas/tokens/env privados não foram versionados; os artifacts originais expiram em 16/10 e as cópias Git permanecem.

Supabase advisors executado somente no stack local da gestão, level error, exit 0; não é auditoria da produção. Cleanup dos dois stacks passou e removeu credenciais locais. productionAccess=false no runner, trafficEnabled=false, productionCutoverExecuted=false, legacyCasOnlyScriptExecuted=false. O NOVO activate-shared-cas.sql foi executado explicitamente somente nos bancos fictícios. MandaBem, WhatsApp, Evolution, executor e webhooks externos não foram ativados.

Limites: trigger chain equivalente capturada em 09/10, sem backup ou dados reais; patch hospedada histórica 17.6 versus local 17.11; funções signup/profile fora da cadeia; sem QA completo de navegador, TLS hospedado, Vercel/Storage API, volume real ou API MandaBem externa. Cache offline representa a última publicação/timestamp, não confirmação de estoque atual. Foram duas execuções necessárias em runner comum (196 + 222 s de parede); não se consultou consumo/minutos faturados/cota pelo conector. Não houve contratação ou aumento de recursos.

## Plano exato antes de qualquer implantação autorizada

1. Reconfirmar Fabio HEAD e a versão servida pela Vercel. Comparar qualquer avanço contra fc6d357, reconciliar seletivamente nesta branch e atualizar proveniência/ensaio. Nenhuma promoção com delta não reconciliado; não usar App da main/D3 antiga.
2. Fazer revisão do diff com Fabio e QA em dois navegadores dos fluxos de gestão, conflito/rascunho/bootstrap, frascos, cancelamento/exclusão, compras, catálogo e metadados MandaBem. Reconferir por leitura a cadeia, estados compartilhados coerentes, grants/roles, flags de normalização e public_catalogs. Identificar todos os writers, inclusive abas/builds/scripts externos, e resolver nomes ambíguos sem adoção/reconciliação automática.
3. Obter autorização separada para janela de manutenção, schema/app/corte e conexão de leitura CRM. Suspender todos os writers e encerrar/recarregar sessões antigas; preparar backup recuperável de estado, catálogo/vínculos, identidades/aliases e metadados. Este checkpoint não concede essa autorização.
4. Com escritores suspensos, aplicar somente migrations ausentes, uma vez e na ordem: app_state existente → public_catalogs nativa (se ausente e estrutura revisada) → D0 → D1 → D2 → D3 → aditivo Fabio. Se estado/estrutura divergir, parar e decidir a reconciliação; não aplicar fixture de gatilhos, não reexecutar D0/D1 depois de D2/D3 e não usar activate-cas-only.sql antigo.
5. Executar dry-run/adoção na revisão observada e comparar invariantes de negócio, perf/vínculos/estoque/disponibilidade/timestamps. Adoção não repara catálogo. Confirmar UUIDs/aliases compartilhados antes de habilitar saves.
6. Promover somente esta integração já reconciliada à branch Fabio realmente publicada, mediante aprovação separada, com a manutenção ainda ativa. Confirmar o build/env corretos e todos os writers CAS; executar novo activate-shared-cas.sql somente após esses gates. Ele fecha app_state e management_state, inclusive privilégios de colunas/service_role. Não reabrir clientes antigos.
7. Validar read/bootstrap/CAS/40001, ausência de 40P01, saldos nas três representações, snapshot público da revisão efetivamente persistida e leitura anon/autenticada. Somente então configurar a chave de leitura no servidor CRM autorizado e validar consumidor/cache sem segunda baixa, perda ou duplicação. Manter WhatsApp/executor/Evolution/webhooks desligados e não chamar MandaBem real como parte desta homologação.
8. Reabrir gestão somente após validação acordada. Em falha, manter manutenção e suspender publicação/sync; não reativar writer legado contra CAS nem remover UUIDs/aliases ou repetir descontos. Qualquer restauração precisa coordenar banco/aplicação pelo backup autorizado.

**Encerramento: somente homologação isolada. Não houve merge na Fabio/main/PR #17, deploy operacional, SQL de escrita nos projetos reais, alterações no CRM operacional ou autorização de implantação.**
