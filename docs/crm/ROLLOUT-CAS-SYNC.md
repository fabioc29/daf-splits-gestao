# Fundação CAS e sincronização CRM — 8/10/2026

Base: PR #17, `316a707bad1f9cec90dc3b657c25403b05b8f217`; main `0ffcfd65edf9141f44c0fd31c1370b226438bf9c`.

Os arquivos são preparados para homologação isolada. Nenhum SQL ou dado de produção foi executado nesta implementação. A branch fabio não foi incorporada. O CRM nunca chama o salvamento da gestão.

## Ordem coordenada

1. Em Supabase **isolado**, confirmar a migration existente `20261007233000_crm_read_feed.sql`.
2. Aplicar `20261008110000_app_state_cas.sql` e `20261008113000_crm_conditional_feed.sql`. São aditivas; o primeiro rollout ainda permite os escritores antigos.
3. Fazer backup completo. Com a conta proprietária, ler `daf_read_app_state()` e executar `daf_adopt_external_ids(revision, true)` para dry-run. Comparar contagens, estoque, ml, vendas, valores, vínculos e IDs numéricos. Somente com autorização, executar o mesmo procedimento com `false`. Ele acrescenta UUID/aliases, não renumera pedidos nem redistribui estoque; não roda em leitura, build ou feed.
4. Validar o dashboard atualizado: todos os caminhos de salvamento usam `daf_save_app_state(expected_revision, data)`. Edição local permanece pendente até confirmação. Não há fallback de escrita direta nem merge automático de um estoque concorrente.
5. Testar duas sessões: A salva, B recebe `REVISION_CONFLICT`, conserva/exporta rascunho e só carrega a nuvem por decisão explícita. Fechar abas/versões antigas antes do corte.
6. **Outra operação autorizada**, fora das migrations automáticas: executar `scripts/activate-cas-only.sql` em janela coordenada. Ela revoga INSERT/UPDATE/DELETE diretos e marca `writer_policy=cas-only`. Não executar isoladamente antes de o novo dashboard estar validado e pronto.
7. Gerar chave de leitura somente no ambiente autorizado. O CRM usa seu próprio Supabase e recebe apenas essa capacidade de leitura; nunca a service role do dashboard.

Enquanto `writer_policy=compatibility`, CAS protege o cliente atualizado, mas um escritor antigo ainda pode competir. O feed informa essa limitação e o CRM não ativa efeitos prospectivos por venda como se todos os escritores já estivessem protegidos. Um escritor antigo que elimine metadados invalida a prontidão de identidade; não fabricar novamente UUIDs em leitura.

## Contratos

- `daf_read_app_state()` → `{data, revision:string, identitiesReady}`. Proprietário autenticado, sem escrita.
- `daf_save_app_state(p_expected_revision:text,p_data:jsonb)` → `{revision:string,data}`. Lock/CAS inclusive para inserção inicial; revisão bigint no banco, string no wire. Conflito nunca troca a revisão de um payload antigo para aceitá-lo.
- `daf_adopt_external_ids(p_expected_revision:text,p_dry_run:boolean=true)` → contagens/adoções/revisão. Preparação explícita, transacional e idempotente de metadados.
- `daf_crm_feed(token,contract_version)` permanece incondicional. Antes de cada publicação real o CRM exige esta chamada nova, sem cache HTTP.
- `daf_crm_sync_feed(token,contract_version,known_revision,known_state_version)` retorna `changed:false` + meta ou `changed:true` + snapshot completo. Token revogado continua sendo erro, nunca resposta vazia.

Extensões do v2: `externalId`, `legacyIds`, CEP, pagamento, flags de recebível histórico/preparação, referências externas, `stateVersion`, `identityReady`, `writerPolicy` e hash da projeção. CPF, custo, margem, despesas e observações financeiras continuam fora.

Aliases preservam identidade quando muda apenas o número de exibição. Um número de venda reutilizado com outro UUID é outra venda; não substituir a compra antiga no CRM. Referências/categorias de itens legados ainda dependem do cadastro observado: não constituem snapshot histórico do perfume/lote no momento da compra.

## Frascos e APC

Nenhuma mudança de modelo de frascos nem transformação de saldo foi feita. `products.stock` continua líquido e autoritativo. Evidência ausente/agregada bloqueia divulgação/APC no CRM. CAS/UUIDs não transformam o agregado em saldo individual. Conciliação física e feed v3 continuam uma etapa separada.

## Verificação disponível

`npm run test:crm` executa os testes anteriores e CAS/adoção/feed condicional em PostgreSQL/PGlite. Também executar `npm run typecheck`, `npm run typecheck:crm` e `npm run build`.

PGlite usa papéis/auth de teste e SQL real; não substitui GoTrue/PostgREST de Supabase real. Antes de implantação operacional, validar JWTs, grants, RPCs e o corte dos escritores em Supabase local/isolado. Nenhuma confirmação deste documento autoriza merge, credenciais reais ou migration de produção.
