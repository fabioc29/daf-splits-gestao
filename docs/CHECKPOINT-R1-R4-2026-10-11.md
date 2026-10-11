# CHECKPOINT — R1–R4 na integração Fabio — 11/10/2026

**PASS da homologação isolada. Implantação operacional continua bloqueada até nova avaliação e autorização.**

Código Dashboard testado: **2929a0bfb88586d054c3f71ab26c14d7fb846454**, nesta branch `homologacao/fabio-dashboard-crm-20261011`. Correções iniciais em 4e244f5; proteção de edição compatível com CSS nativo em c891102; mensagem de recuperação com estado confirmado em 2929a0b. Base Fabio reconfirmada antes/depois: **fc6d3578132ec94af7fce26f682c84481eb9d24f**. Não houve merge ou alteração de `fabio`, `main` ou PR #17.

CRM/testes efetivos: **d547f56668383575fbd6de332c7e22f0a840671b**. [Actions 38118808471 aprovado](https://github.com/Gabriel-GR1/daf-crm/actions/runs/38118808471), inclusive limpeza e upload. Os dois Supabases descartáveis realmente executaram PostgreSQL 17.11, GoTrue 2.197.0 e PostgREST 16.4; Chromium 156.0.8078.4 e Firefox 157.0 executaram 20 cenários reais, inclusive fechamento/reinício de processos e recuperação do perfil nativo em disco, sem storageState injetado.

[Checkpoint completo, riscos, sequência futura e abortagem](https://github.com/Gabriel-GR1/daf-crm/blob/9d3dd2d878e46ab42a3c7b74881b7669f8a1d96c/daf-crm/docs/CHECKPOINT-R1-R4-2026-10-11.md).
[Manifesto e hashes das evidências](https://github.com/Gabriel-GR1/daf-crm/blob/9d3dd2d878e46ab42a3c7b74881b7669f8a1d96c/daf-crm/docs/evidencias/R1-R4-MANIFEST.json).
[Resultados Chromium/Firefox](https://github.com/Gabriel-GR1/daf-crm/blob/9d3dd2d878e46ab42a3c7b74881b7669f8a1d96c/daf-crm/docs/evidencias/actions-38118808471/BROWSER-QA.json).
[Diff R1–R4 contra a integração anterior](https://github.com/fabioc29/daf-splits-gestao/compare/a67093fbe2bc8e8f7e3283761d9c9a8420a8e47f...2929a0bfb88586d054c3f71ab26c14d7fb846454).

R1 instala somente a migration aditiva `20261011060418_r1_feed_current_authorization.sql`: emissão exige administrador atual; toda leitura completa/condicional verifica o papel atual do dono; revogação própria permanece possível após perder papel. D0/D1/D2/D3 e o aditivo Fabio 20261011035438 ficam intactos.

R2 separa fila CAS e publicação opcional; imagens possuem timeout/fallback e publicação usa apenas RETURNING, com rejeição de revisão atrasada. R3 verifica recuperação por usuário/aba/instância antes de editar, bloqueia quota/acesso negado, preserva exportação em memória e nunca transforma ACK confirmado em escrita incerta por falha de cache. Resultado HTTP incerto não é repetido automaticamente. R4 mantém operações MandaBem fechadas no servidor mesmo com credenciais/flag configuradas, preservando interface/campos/histórico; a execução comercial não está homologada.

28 testes locais/SQL, verificador HTTP central, 11 verificações D3, dez Fabio e 20 de navegador passaram. Regressões de 44→27 sem segunda baixa, compra até 144, frascos, UUIDs/aliases, histórico, conflitos, catálogo somente confirmado e RLS/writers legados mantidas. Falhas anteriores do verificador e o ensaio com mera reabertura de contexto estão preservados no checkpoint completo; nenhuma asserção de saldo foi descartada.

`vercel.json` conserva deploymentEnabled=false para esta branch. Não houve SQL remoto, alteração operacional CRM, deploy, chamada comercial MandaBem, WhatsApp/Evolution/executor/webhook ou contratação de serviço. Perfis e credenciais fictícias ficaram no diretório privado temporário, fora dos artifacts. Estes commits posteriores de documentação não mudam a fonte efetivamente testada.

Próximos estágios exigem autorização separada: backup consistente/restauração privada ensaiada (incluindo Auth/Storage/histórico), reconciliação e QA humano/volume/TLS/Vercel/PG alvo 17.6. MandaBem só pode ser reaberto após revisão própria de autenticação, estado confirmado, idempotência e resultado incerto. Se Fabio avançar, bloquear promoção até reconciliar o delta.
