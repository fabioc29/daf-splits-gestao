# DAF CRM — relatório de finalização e revisão da PR #17

Continuação do checkpoint Astra. Data UTC: 8/10/2026 (7/10 no início da execução em Brasília). Este relatório acompanha o commit final de documentação; o SHA final da PR é registrado no encerramento e na referência GitHub da PR.

## Estado Git e publicação

| Referência | Estado comprovado |
| --- | --- |
| Main | `0ffcfd65edf9141f44c0fd31c1370b226438bf9c` |
| Avanço desde CHECKPOINT-2026-10-07 | **0 commits** |
| PR #17 inicial | `4dc3cba90a94544caf7cad96b780c164b0b804b4`, aberta/rascunho, base main, 7 à frente e 0 atrás |
| Commit de código desta execução na PR | `e97185ac8a6c03f0fb4927c6f7a76070b9d8ed63` — `fix(crm): clarify feed errors and unverified bottle stock` |
| Segundo commit preparado | Documentação de contrato, checkpoint e este relatório, sem mudança de runtime |
| App.tsx da gestão | Blob `e08b4df56abcfc146bccd040295c804cbb3d8fae`, preservado integralmente nesta execução; quatro linhas anteriores de integração continuam |
| Conflitos | Nenhum com main; nenhum rebase necessário; fabio não foi consultada/incorporada/modificada |
| Código do CRM salvo e publicado | `b4e87af5b90f2b1b9336c119f8edb4cd6251517f`, repositório privado do projeto Sites, **versão 4** |
| Preview privado do CRM | https://daf-crm-piloto.gabrielrodrigo013.chatgpt.site |
| Publicação CRM | Sucesso; `appgdep_6ac6e6aea6c8819180dd749ff3921273`, 00:41:39 UTC |
| Ambiente | Revisão 1; apenas `WHATSAPP_SEND_ENABLED=false` e `DAF_INBOUND_ENABLED=false`; nenhuma credencial real |
| Acesso | Proprietário apenas; nenhum novo visitante/sócio autorizado nesta execução |
| Preview da PR no Vercel | https://daf-splits-gestao-git-crm-read-only-feed-20261006-fabio-518e.vercel.app |
| Vercel verificado no commit de código | Status success, deployment Ready; o nome da conta na URL não significa uso da branch fabio |

O preview da gestão foi gerado automaticamente pela integração GitHub/Vercel existente. Sua política de privacidade não foi conferida; **não é declarado privado**. O preview privado confirmado é o CRM do Sites. Nenhum ambiente de produção da gestão foi publicado manualmente. O CRM e a gestão continuam em repositórios distintos: não se copiou uma aplicação inteira para a PR nem se prometeu que fazer merge do dashboard publica o CRM.

Antes de editar, main/PR foram consultadas, o checkpoint completo foi lido e 20 arquivos relevantes de texto do checkout da gestão conferiram por hash com a PR. Não houve atualização automática da branch fabio. As gravações GitHub usaram expected_sha e fast-forward, sem force push.

## Problemas encontrados e correções

| Problema real | Resultado |
| --- | --- |
| Main também soma novas compras ao mesmo produto sem evidência de frasco | CRM mantém saldo visível, mas classifica `unverified` e bloqueia divulgação/APC. Não infere um lote de histórico vazio |
| Formulário de pedido permitia APC sobre saldo agregado | Validação comum exige frasco/lote validado, saldo positivo, APC disponível, volume correspondente e uma unidade |
| Copy/destino inválidos ou imagem inexistente ocupando todos os ciclos | Antes do outbox/envio, aprovação retirada e motivo salvo; próxima divulgação pode seguir no próximo ciclo |
| Ordenação por string e horários UTC em backups | Ordem por instante real, desempate estável e exibição/agrupamento em Brasília |
| Remarcação gerando outro registro com a mesma copy/grupo/instante | Bloqueio de duplicidade e de datas impossíveis; remarcação revoga aprovação |
| Publicação cancelada podia ser reaprovada na interface | Aprovação rejeitada e botões de envio ocultos/desabilitados |
| Histórico não mostrava mídia/revisão que já estavam no payload | API e painel mostram mídia por referência, texto, saldo, revisão e hora da consulta |
| Resposta citada podia se vincular ao modelo alterado depois do envio | Evidência usa o payload efetivamente enviado; identidade do lote guardada no payload; sem criar venda/reserva |
| Rascunho podia acompanhar troca automática de contato | Texto guardado por contato; selecionado sempre pertence ao filtro atual; envio de rascunho tem loading |
| Atalhos de relatório ignoravam o filtro | Segmentos e filas respeitados, incluindo sem compra/sem próxima ação |
| Recepção ativada não aparecia no painel | Status de entrada separado e explícito, sem exposição de segredos |
| Erros de token todos rotulados como migration ausente | Mensagens distinguem instalação, autorização, base vazia e resposta incerta de rede |
| Prévia escondida/atendimento largo no mobile | Prévia mantida, atendimento em uma coluna nas telas estreitas, controles quebrando linha e scroll de diálogo |
| Tipagem suprimida no histórico | Removido @ts-nocheck desse módulo; sem refatorar amplamente o legado |

A correção sobre falta de evidência decorre da main atual, não de uma nova auditoria de fabio. A função de compra procura produto por marca/nome e faz `stock + volume`. A informação que permitiria comprovar cada frasco não existe nesse modelo. Não se mudou o contrato v2, não se fez dupla baixa, não se alocou saldo fictício e nenhum dado histórico foi transformado. Estoque zero/APC indisponível, versão antiga, leitura falha, origem/revisão incorretas e tentativa duplicada continuam bloqueados.

## Arquivos modificados nesta execução

### Gestão / PR #17

- `src/crm/CRMFeedPanel.tsx`
- `src/crm/feed-status.ts` (novo)
- `tests/crm-feed.test.mjs`
- `CRM-INTEGRACAO.md`
- `CRM-CHECKPOINT.md`
- `CRM-VALIDACAO-2026-10-08.md` (novo)

App.tsx, projeção SQL/JS, migration, lockfile, regras de venda/estoque e demais módulos da gestão não foram alterados nesta execução.

### CRM / fonte privada do Sites

- `app/api/connector/[operation]/route.ts`
- `crm/connector.tsx`, `crm/main.tsx`, `crm/profile.tsx`, `crm/workspace.tsx`, `crm/style.css`
- `lib/assets.ts`, `lib/automation.ts`, `lib/daf-domain.ts`, `lib/integrations.ts`, `lib/prepare.ts`
- `package.json` (scripts reproduzíveis de teste/tipos; nenhuma dependência adicionada)
- `tests/daf-domain.test.mjs`, `tests/integrations.test.mjs`, `tests/ui-smoke.mjs`, `tests/fixtures/ui-smoke.tsx`
- `docs/OPERACAO-E-API.md`, `docs/VALIDACAO-2026-10-08.md`, `docs/AMBIENTE-PILOTO.env.example`

Agenda, Clientes, Pedidos, Feedbacks, XLSX, VIP, preferências, recompra, modelos de mensagens e feedback interno do piloto preservados. Nenhuma migration D1 nova, alteração de schema ou seed; schema/migrações conferem com a versão CRM anteriormente publicada.

## Testes executados

| Verificação | Resultado e alcance |
| --- | --- |
| Baseline CRM | 29 aprovados antes das correções |
| CRM completo `node --test tests/*.test.mjs` | **37 aprovados**, 0 falhas, 0 ignorados |
| Idempotência / concorrência | Uma tentativa por source_key; corrida com opt-out/edição aborta; timeout e falha após aceite não repetem |
| Mídia | Hash/deduplicação, 42 referências com um asset, imagem/legenda numa só chamada mockada, mídia ausente bloqueia antes da tentativa |
| Agenda | Futuro/atraso/não aprovado; item bloqueado libera o próximo ciclo; ordenação UTC/-03 e remarcação duplicada |
| Copy / estoque / APC | Saldo já líquido, IDs independentes, 44→27 ml antes de enviar, zero/sold APC/agregado/sem evidência bloqueados, payload imutável |
| Feed v2 | Contrato/identidade/revisão/evidência, rejeição v1, retrocesso e outra base |
| Recepção | Grupo selecionado/participante real, recibo+estado atômicos, replay concorrente único, opt-out/handoff/regras, interesse pela copy enviada |
| Persistência | SQL SQLite real, CAS de revisão, snapshots e rollback de recibo |
| CRM TypeScript | `tsc --noEmit --incremental false`: aprovado |
| Executor | `node --check` nos dois módulos: aprovado; ciclo/spool testados sem iniciar processo/rede |
| CRM build completo | Vinext/Vite: aprovado; **aviso de bundle >500 kB** permanece |
| Dashboard PostgreSQL/PGlite | `npm run test:crm`: **2 aprovados**; um testa SQL real, RLS/escopo, token hash/rotação/revogação, v2 e projeção mínima; outro testa mensagens de falha |
| Dashboard TypeScript | `npm run typecheck` e `npm run typecheck:crm`: aprovados |
| Dashboard build | `npm run build`: aprovado |
| Regressão gestão | App.tsx byte a byte preservado nesta execução e integração compilada junto ao build completo; regras não reescritas |
| Diff whitespace | Aprovado nos dois checkouts |
| GitHub/Vercel | Status e check do commit de código aprovados |

Os testes de transporte têm respostas controladas. Nenhum deles contata Evolution, cliente, grupo ou Supabase de produção. PGlite é PostgreSQL embarcado com papéis/auth/RLS de teste; não substitui validação real do PostgREST, grants e políticas adicionais do projeto autorizado.

## QA e alcance real

`node tests/ui-smoke.mjs` renderizou os 16 componentes anteriores e 7 estados vazios. Foram acrescentados: calendário, quatro abas da ficha e VIP, relatórios, feedbacks, recompra, modelos rápidos, loading inicial, simulação, recepção desligada, cancelamento, ausência de publicação e estoque sem evidência.

Fluxos usando as funções reais: criar/ler XLSX em memória → deduplicar/importar com Falta chamar; Pix pendente impede postagem → Pix conferido → rastreio/mensagem → recebimento/pós-venda sem mudar estoque; tarefa concluída bloqueia follow-up; feedback positivo com melhoria → retorno único. A renderização da fila seleciona só os contatos do filtro.

**QA interativo/visual completo NÃO executado.** A skill Sites exige a ferramenta control-browser neste ambiente gerenciado e ela não está disponível. Não se improvisou outro navegador, não se abriu sessão de produção e não se iniciou servidor de preview. SSR não verifica dimensões, toque, foco, Escape, scroll ou CSS computado. Os ajustes de responsividade foram inspecionados no código, não medidos em navegador. Essa lacuna precisa ser fechada por revisão humana do preview antes da aprovação final de merge caso a política seja QA completo.

## Comprovadamente pronto

- Proposta mínima de leitura e tokens v2, com SQL preparado/testado localmente, sem escrita na gestão.
- CRM consolidado publicado privadamente, tráfego desligado, credenciais ausentes, frontend/módulos anteriores preservados.
- Copies com evidência de lote válida usam saldo atual; demais saldos falham de forma segura.
- Persistência/CAS, outbox, idempotência, mídia por hash, recepção/dedup e relógio implementados e testados localmente.
- Históricos guardam o conteúdo/estoque de cada tentativa; modelos reutilizados não reinterpretam resposta citada.
- Scripts e checklist de ambiente/ativação estão documentados, sem segredos.

## Pendências de desenvolvimento e limitações

1. **Saldo autoritativo por frasco/lote no dashboard atual.** Não é “só uma chave”. A main não traz evidência suficiente; seus registros ficam bloqueados para anúncio/APC. Precisa de modelo explícito e transição segura dos agregados históricos. Nenhuma alteração estrutural arriscada foi feita nesta execução.
2. Recibos completos de entrega/leitura e reconciliação assistida: não implementados. Aceite não comprova entrega; incertos exigem conferência humana.
3. Chatbot autônomo/IA completa não implementados; regras preparam rascunhos. Mensagens soltas em grupo não viram reserva ou interesse confirmado de ml.
4. Cotação/rastreio Mandabem ao vivo não implementados; transportadora, frete e código continuam manuais.
5. Histórico de mensagens extensivo, retenção/limpeza de assets não referenciados e eliminação geral das supressões legadas de tipos são trabalho posterior.
6. Limites mantidos: uma publicação por ciclo, janela de 5 minutos, máquina/relógio/conector ativos, 1,5 MB de estado, 10 snapshots, histórico de conversa limitado e sem reserva transacional com WhatsApp. Venda após leitura ainda pode ocorrer antes da publicação.

## Dependências apenas externas (sem execução nesta entrega)

- Ambiente isolado Supabase autorizado: aplicar `20261007233000_crm_read_feed.sql`, testar PostgREST v2 e publicar dashboard autorizado.
- Gerar chave revogável pelo proprietário; configurar `DAF_DASHBOARD_URL`, `DAF_DASHBOARD_ANON_KEY`, `DAF_DASHBOARD_READ_TOKEN` no servidor privado. As chaves não foram geradas nesta execução.
- Provisionar/parear Evolution e configurar URL HTTPS, API key, instância, relay/segredos e rotina. Não iniciado.
- Autorizar destinatário/grupo de teste antes de validar interoperabilidade. Só depois ativar as flags, separadamente, com autorização.
- Compartilhar o preview com sócios apenas quando solicitado; o acesso atual continua do proprietário.

O checklist de ambiente existe no CRM em `docs/AMBIENTE-PILOTO.env.example`. Seus únicos valores são flags falsas e campos vazios. Configurar leitura não resolve a falta de lotes.

## Situação para merge e próximos passos

**PR apta à revisão final do código; merge automático não realizado.** A integração está baseada na main correta e não há falha nos gates automatizados disponíveis. Não declarar “todas as verificações concluídas”: falta QA visual/interativo. A aprovação final de merge continua condicionada à revisão humana desses fluxos. Isso é um gate de validação, não uma falha de compilação nem uma necessidade de ligar WhatsApp.

A ausência de saldo por frasco bloqueia a **ativação de anúncios/APC**, não torna a integração operacional por si só. É uma limitação funcional declarada que o responsável pela revisão deve aceitar; não foi mascarada como integração concluída. O merge de código não autoriza migration, dados de produção, credenciais ou tráfego.

Ordem sugerida: QA humano do preview com dados fictícios e tráfego desligado → revisão final da PR e confirmação de merge pelo usuário → trabalho específico de lotes → staging PostgREST e conexão autorizada de leitura → teste Evolution/relay com destino autorizado → ativação gradual. Manter fora desta revisão redesenho amplo, refatoração por estilo, automação 24/7, recibos completos e otimização opcional de bundle.

## Restrições respeitadas

- Sem merge, force push, alteração de main ou incorporação de fabio.
- Sem SQL/migration Supabase aplicado em produção; sem nova migration D1 ou alteração de schema.
- Sem leitura/gravação de dados de produção por operações desta execução, seed, restore ou importação de cenários na base hospedada.
- Sem credenciais reais configuradas, pareamento, envio ou recepção reais.
- Somente código/artefato privado do CRM e duas flags desativadas publicados; audiência preservada.
