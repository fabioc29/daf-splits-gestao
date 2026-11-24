-- DAF Splits — preços por frasco no catálogo público.
--
-- Permite que a publicação do catálogo leve os preços do frasco atual
-- (campo "prices" de cada perfume). Em vez de reescrever as funções, este
-- script lê a definição que está NO BANCO agora e troca só dois trechos:
--   1. private.daf_public_catalog_base: passa a montar "prices" a partir de
--      products[].bottlePrices[bottleNumber];
--   2. public.daf_publish_catalog: passa a aceitar a chave "prices".
-- Se algum trecho esperado não for encontrado, o script para com erro e NADA
-- é alterado (tudo roda numa única transação). Rodar duas vezes não muda nada.

do $$
declare
  base_def text;
  publish_def text;
  base_needle constant text := $n$'apc',coalesce((p->>'apc')::numeric,0)>0)||$n$;
  base_patch constant text := $n$'apc',coalesce((p->>'apc')::numeric,0)>0)||
  case when jsonb_typeof(p->'bottlePrices'->(p->>'bottleNumber'))='object'
   then jsonb_build_object('prices',p->'bottlePrices'->(p->>'bottleNumber')) else '{}'::jsonb end||$n$;
  -- Só a lista de campos aceitos (termina em "]))) then"); a linha que separa os
  -- campos de imagem também cita 'fragranticaId','manualImage' e não deve mudar.
  publish_needle constant text := $n$'bottle','imageUrl','fragranticaId','manualImage'])))$n$;
  publish_patch constant text := $n$'bottle','imageUrl','fragranticaId','manualImage','prices'])))$n$;
  occurrences int;
begin
  base_def := pg_get_functiondef('private.daf_public_catalog_base(jsonb)'::regprocedure);
  publish_def := pg_get_functiondef('public.daf_publish_catalog(text,jsonb)'::regprocedure);

  -- 1) Base do catálogo
  if position('bottlePrices' in base_def) > 0 then
    raise notice 'daf_public_catalog_base já monta os preços — mantido.';
  else
    occurrences := (length(base_def) - length(replace(base_def, base_needle, ''))) / length(base_needle);
    if occurrences <> 1 then
      raise exception 'DAF: trecho esperado em daf_public_catalog_base encontrado % vez(es). Nada foi alterado.', occurrences;
    end if;
    execute replace(base_def, base_needle, base_patch);
    raise notice 'daf_public_catalog_base atualizado com os preços.';
  end if;

  -- 2) Lista de campos aceitos na publicação
  if position(publish_patch in publish_def) > 0 then
    raise notice 'daf_publish_catalog já aceita "prices" — mantido.';
  else
    occurrences := (length(publish_def) - length(replace(publish_def, publish_needle, ''))) / length(publish_needle);
    if occurrences <> 1 then
      raise exception 'DAF: trecho esperado em daf_publish_catalog encontrado % vez(es). Nada foi alterado.', occurrences;
    end if;
    execute replace(publish_def, publish_needle, publish_patch);
    raise notice 'daf_publish_catalog passa a aceitar "prices".';
  end if;
end$$;

notify pgrst, 'reload schema';

-- Conferência (deve retornar true, true):
-- select position('bottlePrices' in pg_get_functiondef('private.daf_public_catalog_base(jsonb)'::regprocedure)) > 0 as base_ok,
--        position($q$'manualImage','prices'])))$q$ in pg_get_functiondef('public.daf_publish_catalog(text,jsonb)'::regprocedure)) > 0 as publish_ok;
