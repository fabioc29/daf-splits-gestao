# D3 — compatibilidade do estado compartilhado

Branch separada `homologacao/d3-shared-cas-20261009`, baseada somente na PR #17 em `2a65401b66ffc2d15adf2c82ecff3fb310d1a1dd`. D0/D1/D2, contratos de feed v2, projeção CRM e o script histórico `activate-cas-only.sql` não foram alterados. Este documento não autoriza produção.

## Objetos e comportamento

Migration aditiva `20261009183838_shared_state_cas_compatibility.sql`. Exige a cadeia compartilhada existente e todos os `app_state.data` iguais ao singleton `management_state.data`; divergência interrompe a instalação, sem reconciliar estoque. Não adota identidades, altera catálogo nem desconta vendas durante a instalação.

Todos os escritores das quatro tabelas da cadeia adquirem o advisory lock global `(20261009,3)` em BEFORE STATEMENT, antes de locks de linhas. Save, adoção e bootstrap adquirem esse mesmo lock antes do lock individual. Cada save compara a revisão do usuário; a propagação de uma mudança de dados invalida os outros snapshots. Um conflito exige releitura e decisão do operador; nunca rebase automático do estoque.

Escrita interna de estados usa uma capacidade privada por backend/transação, sem grants de tabela ou EXECUTE a clientes/serviço. Grants de DML e de colunas de `management_state` são revogados já na instalação; o propagador interno permanece autorizado. GUC ou profundidade de trigger não servem como autorização. Os novos auxiliares têm `search_path=''`; tabelas privadas têm RLS e nenhum grant de API. RPCs de estado exigem usuário autenticado com o role admin real.

`daf_bootstrap_app_state()` não aceita payload. Admin sem estado recebe o snapshot compartilhado e revisão realmente persistidos; chamadas repetidas são idempotentes. Save de estado ausente retorna `STATE_BOOTSTRAP_REQUIRED`/`40001`, sem gravar ou confirmar um rascunho. `daf_save_app_state` retorna `RETURNING data, revision`. O único ajuste no aplicativo é usar `initializeState` na carga inicial; polling e feed continuam somente leitura. Os saves legítimos identificados na PR #17 já usam CAS. Não foi identificada escrita de `management_state` no código dessa PR; builds/jobs externos de produção ainda precisam de confirmação na janela autorizada.

Comparação integral de negócio remove apenas `externalId`/`legacyIds` de produtos, clientes e vendas. Alteração exclusiva desses metadados não chama ensure/sync de catálogo, inclusive quando há vínculo ausente. Adoção não é reparo de drift. Aliases são registrados para cada administrador que recebe o mesmo estado; UUID conhecido não pode mudar de namespace, inclusive entre administradores.

Renumeração mapeia OLD/NEW pelo mesmo UUID, valida toda a correspondência e muda apenas `management_product_id` no vínculo existente. Renumeração pura conserva todas as colunas do perfume e demais colunas do vínculo, inclusive timestamps. Swaps, destino ocupado, vínculo de origem ausente, UUID duplicado ou IDs numericamente ambíguos são rejeitados atomicamente. Não há merge por nome/marca nem criação de perfume para esse UUID. Alterações reais de produto/estoque continuam executando ensure/sync existentes.

## Corte futuro e obrigatório

A instalação mantém o writer legado de `app_state` na fase de compatibilidade. Essa fase não oferece exclusividade CAS e não autoriza operação definitiva após adoção. O corte novo `scripts/activate-shared-cas.sql` é separado, exige identidades adotadas/estados coerentes e fecha DML dos DOIS estados, inclusive service_role e privilégios de colunas. Também bloqueia RPCs antigos SECURITY DEFINER sem capacidade privada. Ele não é migration automática; somente o ensaio descartável pode executá-lo nesta tarefa. O script antigo que fecha apenas `app_state` não deve ser usado nessa cadeia.

Produção exige autorização separada: pausar todos os writers, backup privado/restauração ensaiada e comparação consistente; conferir objetos/ledger/builds; aplicar somente D0→D1→D2→D3 ausentes; promover o dashboard atualizado na mesma janela; adotar UUIDs uma vez pelo admin com revisão observada e dry-run; comparar negócio e TODO catálogo/vínculos/timestamps; executar o corte novo expressamente autorizado; verificar grants, CAS/bootstrap/aliases e o app servido antes de reabrir writers. Só então autorizar conexão de leitura do CRM. Não testar vendas ou estoque fictício em produção.

Administração SQL/DDL com owner/superuser continua confiável e fora da API; não é liberada para contornar revisão. Qualquer manutenção real precisa de aprovação própria, writers pausados e comparação do estado atual. Escritor externo desconhecido ou que não possa usar o CAS é bloqueio operacional; adaptar para read/bootstrap + save com a revisão real, sem criar exceção ao guard.

Rollback não reabre escritores antigos que apagam UUIDs e não restaura saldo antigo sobre operações novas. Falha de DDL exige rollback transacional; divergência exige pausa e diagnóstico isolado. Falha do consumidor exige suspender/revogar leitura, conservando cache/histórico. Não fazer merge, deploy, ativação de tráfego ou rollout nesta homologação.

## Evidência

O CRM de homologação conserva fixture byte a byte da D3 e do corte, SHA-256, Git blob SHA e commit fonte em `tests/fixtures/dashboard-d3/PROVENANCE.json`. O workflow de dois Supabases reais roda a regressão anterior em compatibilidade e os seis casos corrigidos com corte isolado. Verificadores/evidências do baseline BLOCKED permanecem preservados; testes locais não substituem PASS HTTP real. Resultado e limitações ficam no checkpoint versionado do CRM.
