-- manifest: **Excluir contato com compromissos na Agenda.** `fn_apagar_compromissos_do_contato(p_contact_id, p_organization_id, p_incluir_futuros)` apaga os compromissos do contato que já acabaram, foram cancelados ou não compareceram (sempre) e, só quando a pessoa confirma na tela, também os que ainda vão acontecer. A rota de exclusão chama antes de `fn_apagar_contato_com_historico`; antes disso o `calendar_appointments.contact_id ... on delete restrict` barrava a exclusão por um compromisso que nem aparecia mais na tela. `security invoker`: vale a RLS de quem chama. Gates: tests/unit/contato-delete.test.ts.

-- 9112 — EXCLUIR O CONTATO QUE TEM COMPROMISSO NA AGENDA.
--
-- O `calendar_appointments.contact_id` é `on delete restrict` (cinto contra apagar histórico). O efeito prático: um compromisso
-- CANCELADO, CONCLUÍDO ou já PASSADO continuava barrando a exclusão do contato — e a tela dizia "cancele ou apague o compromisso",
-- coisa que a Agenda não faz (não existe "apagar compromisso", e o cancelado continua ligado ao contato).
--
-- Regra nova, decidida com o dono:
--   • compromisso ENCERRADO (cancelado, concluído, não compareceu ou que já terminou) não barra: sai junto com o contato;
--   • compromisso FUTURO e ativo (pendente/confirmado, ainda por acontecer) continua barrando, a menos que a pessoa marque,
--     no diálogo, "apagar também os compromissos futuros" (`p_incluir_futuros = true`).
--
-- `security invoker` de propósito: a RLS de quem chama continua valendo e o filtro por organização é do argumento + WHERE. Se a RLS
-- não deixar apagar, a contagem volta 0 e a exclusão do contato falha como antes (23503, sem perda). Retorna quantos foram apagados.
create or replace function public.fn_apagar_compromissos_do_contato(
  p_contact_id uuid,
  p_organization_id uuid,
  p_incluir_futuros boolean default false
)
returns integer
language plpgsql
volatile
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare
  apagados integer;
begin
  delete from public.calendar_appointments a
   where a.contact_id = p_contact_id
     and a.organization_id = p_organization_id
     and (
       p_incluir_futuros
       or a.status not in ('pending', 'confirmed')
       or a.ends_at <= now()
     );
  get diagnostics apagados = row_count;
  return apagados;
end;
$$;

revoke execute on function public.fn_apagar_compromissos_do_contato(uuid, uuid, boolean) from public, anon;
grant  execute on function public.fn_apagar_compromissos_do_contato(uuid, uuid, boolean) to authenticated, service_role;

notify pgrst, 'reload schema';
