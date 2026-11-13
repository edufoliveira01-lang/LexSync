-- manifest: **Mensagens programadas (Inbox).** Tabela nova `scheduled_messages`: qualquer atendente programa um texto para uma conversa, com data/hora de envio e a escolha, POR mensagem, de `cancel_on_reply` (cancelar se o cliente responder antes) ou envio permanente. Estados `pending → sending → sent | failed | canceled`; a tarefa `cron/scheduled-messages` reivindica a linha (`pending → sending`) antes de enviar, então duas rodadas nunca enviam a mesma. RLS: leitura por quem enxerga a conversa; inclusão por `agent+` da própria organização como autor; atualização (cancelar) por `agent+`; sem DELETE. `anon` sem privilégio e grant EXPLÍCITO a `authenticated` e `service_role`. Idempotente; espelho verbatim no `baseline.sql`.

-- 9109 — MENSAGENS PROGRAMADAS.
--
-- A tela do Inbox ganha "Programar": o atendente escolhe quando uma mensagem
-- sai sozinha. O envio em si NÃO mora aqui — a tarefa do servidor usa o mesmo
-- `sendMessageHandler` de todo envio (com o autor humano que programou), para
-- herdar as guardas de sempre (organização operante, número do atendente,
-- janela do canal oficial, contato bloqueado). Esta tabela só guarda o pedido.
--
-- `cancel_on_reply`: por mensagem, como o dono decidiu. `true` (o padrão) = se
-- o cliente escrever depois de a mensagem ser programada, a tarefa a cancela e
-- registra o motivo; `false` = sai mesmo assim.
--
-- Estados:
--   pending   à espera do horário
--   sending   reivindicada pela tarefa (impede envio em dobro entre rodadas)
--   sent      enviada (`message_id` aponta para a linha em `messages`)
--   failed    não saiu (`error` diz por quê)
--   canceled  cancelada por uma pessoa ou pela resposta do cliente
--             (`canceled_reason`: 'manual' | 'cliente_respondeu')

create table if not exists public.scheduled_messages (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  conversation_id    uuid not null references public.conversations(id) on delete cascade,
  body               text not null check (char_length(btrim(body)) between 1 and 4000),
  send_at            timestamptz not null,
  cancel_on_reply    boolean not null default true,
  status             text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'canceled')),
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  processed_at       timestamptz,
  canceled_reason    text,
  error              text,
  message_id         uuid
);

-- O caminho quente da tarefa: só as pendentes, na ordem do horário.
create index if not exists idx_scheduled_messages_due
  on public.scheduled_messages (send_at)
  where status = 'pending';

-- O caminho da tela: as programadas desta conversa.
create index if not exists idx_scheduled_messages_conversation
  on public.scheduled_messages (conversation_id, status, send_at);

alter table public.scheduled_messages enable row level security;

revoke all on public.scheduled_messages from public, anon, authenticated, service_role;
grant select, insert, update on public.scheduled_messages to authenticated;
grant select, insert, update, delete on public.scheduled_messages to service_role;

drop policy if exists scheduled_messages_select on public.scheduled_messages;
create policy scheduled_messages_select on public.scheduled_messages
  for select to authenticated
  using (
    organization_id in (select public.fn_user_org_ids())
      and exists (
        select 1 from public.conversations c
         where c.organization_id = scheduled_messages.organization_id
           and c.id = scheduled_messages.conversation_id
           and public.fn_can_view_conversation(c.organization_id, c.assigned_to_user_id)
      )
  );

-- Inclusão: agente (ou acima) da PRÓPRIA organização, e como autor de si mesmo.
drop policy if exists scheduled_messages_insert on public.scheduled_messages;
create policy scheduled_messages_insert on public.scheduled_messages
  for insert to authenticated
  with check (
    organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'agent')
      and created_by_user_id = auth.uid()
      and status = 'pending'
      and exists (
        select 1 from public.conversations c
         where c.organization_id = scheduled_messages.organization_id
           and c.id = scheduled_messages.conversation_id
           and public.fn_can_view_conversation(c.organization_id, c.assigned_to_user_id)
      )
  );

-- Atualização (cancelar): agente ou acima, de uma conversa que enxerga.
drop policy if exists scheduled_messages_update on public.scheduled_messages;
create policy scheduled_messages_update on public.scheduled_messages
  for update to authenticated
  using (
    organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'agent')
      and exists (
        select 1 from public.conversations c
         where c.organization_id = scheduled_messages.organization_id
           and c.id = scheduled_messages.conversation_id
           and public.fn_can_view_conversation(c.organization_id, c.assigned_to_user_id)
      )
  )
  with check (
    organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'agent')
  );
