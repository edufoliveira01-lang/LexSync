-- manifest: **Agenda do Google: janela de leitura de 30 dias para trás e nome da agenda no bloco.** A releitura completa passa a cobrir de 30 dias atrás (antes, 1 dia) até 90 dias à frente, trocando UMA expressão dentro de `fn_google_calendar` (idempotente). `fn_agenda_ocupacao_google_com_titulo` ganha `calendar_name`, só das agendas com `show_titles` (agenda sem título ligado não revela nem o nome). Gates: tests/unit/ocupacao-do-google-nao-expoe-titulo.test.ts.

-- 9111 — A JANELA DO ESPELHO DO GOOGLE E O NOME DA AGENDA NO BLOCO.
--
-- ─── A janela ───────────────────────────────────────────────────────────────
--
-- A releitura completa de uma agenda do Google (`fn_google_calendar('claim')`, quando `rebuild_full`) pedia de `now() - 1 day`
-- até `now() + 90 days`. Quem usa a Agenda como painel do escritório quer rever a semana passada: a janela passa a começar 30 dias
-- atrás. O passado não bloqueia horário nenhum (o motor só olha o que cruza o intervalo pedido), então só aumenta o volume lido.
--
-- A troca é de UMA expressão dentro do corpo da função, feita sobre a definição que está VIVA no banco (`pg_get_functiondef`):
-- não copia o corpo (a função é grande e foi redefinida em várias migrations) e não regride nada que um conserto posterior tenha
-- mudado. Idempotente: se a expressão antiga não está mais lá, não faz nada. Mantém dono e permissões (`create or replace`).
do $$
declare
  def text;
begin
  select pg_get_functiondef(p.oid) into def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'fn_google_calendar'
   limit 1;
  if def is not null and position('now()-interval ''1 day''' in def) > 0 then
    execute replace(def, 'now()-interval ''1 day''', 'now()-interval ''30 days''');
  end if;
end
$$;

-- As agendas já lidas só ampliam na PRÓXIMA releitura completa (a cada 24 h); limpar o token faz a rodada de 1 min refazê-la agora.
update public.calendar_connection_calendars
   set sync_token = null,
       sync_next_attempt_at = now()
 where counts_for_conflicts;

-- ─── O nome da agenda no bloco ──────────────────────────────────────────────
-- Passar o mouse num bloco diz o título, o horário e DE QUAL agenda do Google ele é. O nome só sai das agendas com `show_titles`:
-- "MINHA AGENDA PESSOAL" ou "Terapia" são, eles mesmos, conteúdo.
drop function if exists public.fn_agenda_ocupacao_google_com_titulo(uuid, uuid, timestamptz, timestamptz);

create function public.fn_agenda_ocupacao_google_com_titulo(
  p_org uuid,
  p_owner uuid,
  p_de timestamptz,
  p_ate timestamptz
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz,
  transparency text,
  status text,
  connection_status text,
  title text,
  calendar_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.starts_at, e.ends_at, e.transparency, e.status, c.status,
         case when k.show_titles then t.title else null end,
         case when k.show_titles then k.name else null end
    from public.calendar_selected_external_events e
    join public.calendar_connections c
      on c.organization_id = e.organization_id
     and c.id = e.connection_id
    left join public.calendar_connection_calendars k
      on k.organization_id = e.organization_id
     and k.connection_id = e.connection_id
     and k.external_calendar_id = e.external_calendar_id
    left join public.calendar_external_event_titles t
      on t.organization_id = e.organization_id
     and t.connection_id = e.connection_id
     and t.external_calendar_id = e.external_calendar_id
     and t.external_event_id = e.external_event_id
   where (auth.uid() is null
          or p_org in (select public.fn_user_org_ids())
          or public.fn_is_platform_admin())
     and e.organization_id = p_org
     and c.user_id = p_owner
     and e.starts_at < p_ate
     and e.ends_at > p_de;
$$;

revoke execute on function public.fn_agenda_ocupacao_google_com_titulo(uuid, uuid, timestamptz, timestamptz) from public, anon;
grant  execute on function public.fn_agenda_ocupacao_google_com_titulo(uuid, uuid, timestamptz, timestamptz) to authenticated, service_role;

notify pgrst, 'reload schema';
