-- manifest: **Título dos eventos do Google, por agenda (opt-in).** `calendar_connection_calendars.show_titles` (padrão `false`) liga, agenda a agenda, o título que a equipe vê no bloco do Google na Agenda. O título mora numa tabela À PARTE (`calendar_external_event_titles`, só service_role escreve, nenhum acesso direto de `authenticated`) e só sai pela função `fn_agenda_ocupacao_google_com_titulo`, que o devolve APENAS das agendas marcadas. `calendar_external_events.title` continua nulo e sem privilégio (0261 intacta). Gates: tests/unit/titulo-do-google-por-agenda.test.ts e tests/unit/ocupacao-do-google-nao-expoe-titulo.test.ts.

-- 9110 — O TÍTULO DOS EVENTOS DO GOOGLE, POR AGENDA.
--
-- ─── A decisão do dono ──────────────────────────────────────────────────────
--
-- O espelho da agenda do Google guardava só ocupado/livre: o título nunca é
-- gravado (0261 revogou a coluna). Num escritório, porém, agendas como
-- "ATENDIMENTO …", "AUDIENCIA" e "PRAZO JURIDICO" são de TRABALHO, e o título
-- (cliente, tipo de audiência) é o que a equipe precisa ver. O dono decidiu:
-- LIGAR POR AGENDA, DESLIGADO POR PADRÃO. Agenda pessoal continua "Ocupado".
--
-- ─── Por que uma tabela À PARTE, e não a coluna `title` ─────────────────────
--
--  · `fn_google_calendar` ('item') grava `title=null` e é uma função enorme,
--    redefinida em várias migrations; mexer nela arriscaria a leitura inteira.
--  · A 0261 fechou o privilégio da coluna e há invariantes que a vigiam. Reabri-la
--    para "só algumas agendas" seria uma exceção dentro da cerca.
--  · Uma tabela própria, com a linha apontando para o evento por FK com cascata,
--    some junto com o evento (cancelado, fora da janela, expurgo) sem código novo.
--
-- Quem ESCREVE: o executor da leitura (service_role), depois de gravar o lote,
-- só para agendas com `show_titles`. Quem LÊ: só a função abaixo, que junta a
-- agenda e confere `show_titles` NA HORA — desligar a opção esconde o título
-- no mesmo instante, antes de o executor apagar as linhas.

alter table public.calendar_connection_calendars
  add column if not exists show_titles boolean not null default false;

comment on column public.calendar_connection_calendars.show_titles is
  'Quando true, o título dos eventos DESTA agenda do Google aparece para a equipe no bloco da Agenda. Padrão false: a agenda pessoal continua só "Ocupado". Decisão do dono (9110).';

create table if not exists public.calendar_external_event_titles (
  organization_id      uuid not null,
  connection_id        uuid not null,
  external_calendar_id text not null,
  external_event_id    text not null,
  title                text not null,
  updated_at           timestamptz not null default now(),
  primary key (organization_id, connection_id, external_calendar_id, external_event_id),
  constraint calendar_external_event_titles_evento_fkey
    foreign key (organization_id, connection_id, external_calendar_id, external_event_id)
    references public.calendar_external_events (organization_id, connection_id, external_calendar_id, external_event_id)
    on delete cascade,
  constraint calendar_external_event_titles_tamanho check (char_length(title) between 1 and 300)
);

alter table public.calendar_external_event_titles enable row level security;
-- Sem policy para `authenticated`: ninguém lê nem escreve direto. Só service_role (executor)
-- e a função `security definer` abaixo.
revoke all on public.calendar_external_event_titles from public, anon, authenticated;
grant select, insert, update, delete on public.calendar_external_event_titles to service_role;

comment on table public.calendar_external_event_titles is
  'Títulos dos eventos do Google das agendas com show_titles. Escrita só pelo executor (service_role); leitura só por fn_agenda_ocupacao_google_com_titulo.';

-- A mesma ocupação de `fn_agenda_ocupacao_google_do_dono` (0260), com UMA coluna a mais: o título,
-- que só vem quando a agenda do evento tem `show_titles`. A régua de acesso é a mesma da 0260.
create or replace function public.fn_agenda_ocupacao_google_com_titulo(
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
  title text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.starts_at, e.ends_at, e.transparency, e.status, c.status,
         case when k.show_titles then t.title else null end
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
