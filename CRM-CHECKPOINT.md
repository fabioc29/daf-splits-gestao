# Checkpoint de integração — 7 de outubro de 2026

## Estado conferido antes de qualquer edição

- `main`: `0ffcfd65edf9141f44c0fd31c1370b226438bf9c`, sem avanço desde a execução anterior (0 commits).
- PR #17: aberta, em rascunho, base `main`, head inicial `cbb0b342b3a7bc650865d62b86f73858fb739d72`, cinco commits anteriores persistidos, GitHub indicava merge possível.
- `fabio`: `9614040d988ee540dd577cb3fcb38a20e150b6a2`, 204 commits à frente da main. Foram encontrados 45 commits após a criação do último commit da PR (6/10 03:32:53 UTC), dos quais 42 posteriores à publicação anterior do CRM (6/10 03:49:02 UTC).
- As três referências foram reconferidas antes de salvar esta revisão. Main e fabio não foram alteradas. A PR não foi mesclada ou redirecionada.

## Trabalho de Fábio preservado

Entre os avanços recentes estão catálogo público/editor, layout mobile, menus reordenáveis, financeiro, saúde e reposição de insumos, filtros de APC, histórico e numeração de frascos. Os 45 commits recentes modificam App.tsx, Catalog.tsx, catalog.css e index.css. A interseção com a PR original é App.tsx; existe também uma colisão semântica entre os números de migração.

A PR mantém as quatro linhas aditivas originais em App.tsx. Esta revisão não substitui seu conteúdo e não incorpora os 204 commits de fabio em uma PR voltada à main.

Uma simulação local de merge com fabio encontrou três conflitos: imports do catálogo, item de Configurações no menu e condição conjunta de estoque/insumos. A resolução preserva tudo de fabio e acrescenta só import, menu e renderização de CRM. Está em `docs/crm/compat-fabio-9614040.patch`. Aplicar somente sobre uma cópia conferida daquele commit, depois de trazer os módulos CRM e resolver conscientemente qual será a branch de destino. O patch não é uma autorização de merge nem foi aplicado remotamente em fabio. A combinação foi compilada e passou na verificação de tipos local.

## Correções desta revisão

1. Migração renomeada para `20261007233000_crm_read_feed.sql`, evitando o mesmo prefixo de `202610060001_create_public_catalog.sql` da branch fabio.
2. Feed e exportação v2 passam número/histórico mínimo dos frascos. Stock permanece o saldo líquido de products.stock, sem descontar vendas novamente.
3. Na versão recente de fabio, uma compra pode somar novos frascos ao mesmo product.id. O feed v1 ocultava essa informação. O CRM consolidado bloqueia copies desses saldos agregados: não calcula um APC fictício nem inventa a distribuição dos ml. Uma futura modelagem explícita por lote/frascos requer alinhamento com a manutenção da gestão.
4. Teste de integração SQL local com PostgreSQL/PGlite, cobrindo escopo, hash, rotação/revogação, RLS, ausência de escrita via acesso anônimo e projeção mínima.
5. Scripts de teste e tipos, com quatro dependências de desenvolvimento adicionadas (incluindo a transitiva csstype). Nenhuma dependência de execução foi atualizada. O script de tipos usa resolução Bundler; a resolução Node antiga do tsconfig legado é rejeitada pela versão de TypeScript do lockfile.

## Validação

- `npm run test:crm`: 1 teste de integração PostgreSQL com múltiplas verificações, aprovado; banco em memória, sem acesso ao Supabase real.
- `npm run typecheck`, `npm run typecheck:crm`: aprovados.
- `npm run build`: aprovado.
- Combinação local fabio + integração: tipos e build aprovados; os arquivos de referência foram conferidos por hash.
- O CRM também possui 29 testes aprovados de domínio, saída, concorrência, mídia, recepção e executor; TypeScript e renderização de componentes aprovados. O checkpoint do projeto CRM documenta os limites operacionais.

## Próxima etapa

Definir com o mantenedor se a integração será levada primeiro a fabio ou se o trabalho dessa branch será integrado à main. Não resolver isso substituindo App.tsx antigo. Validar o modelo de saldo por frasco antes de liberar APC de produtos agregados. Somente depois, com autorização de ativação, instalar o SQL em ambiente de teste, configurar o token no CRM e realizar teste controlado de WhatsApp. Nenhuma migração, dado de produção, pareamento ou mensagem real foi executada nesta revisão.

O contrato v2 também é exigido na requisição (`p_contract_version`), não apenas na resposta. A assinatura antiga do RPC é mantida sem permissão de uso; clientes antigos falham de forma segura em vez de ignorar os frascos agregados. Na ativação, publicar primeiro o CRM consolidado com envio desabilitado. Os testes incluem rejeição do consumidor antigo e da versão de contrato incorreta.
