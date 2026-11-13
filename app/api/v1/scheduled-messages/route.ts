/**
 * GET /api/v1/scheduled-messages — o CONTROLE das mensagens programadas da organização: quem, para quem, quando, e o que aconteceu
 * (aguardando, enviada, respondida pelo cliente, cancelada, falhou).
 *
 * "Respondida" não é um estado da tabela: é derivada. A mensagem foi enviada (`sent`) e o cliente escreveu DEPOIS do envio
 * (`conversations.last_inbound_at > processed_at`). É uma leitura honesta, mas aproximada: ela diz que o cliente voltou a falar depois,
 * não que a resposta foi sobre aquela mensagem.
 *
 * O client é o da SESSÃO: a RLS de `scheduled_messages` decide o que cada atendente enxerga. Sem a tabela (SQL ainda não aplicado) a
 * resposta é uma lista vazia com `tabela_ausente`.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { rotuloDoContatoParaEquipe } from "@/lib/mensagens-programadas/rotulo-do-contato";

export const dynamic = "force-dynamic";

const LIMITE = 200;

export type SituacaoDaProgramada = "aguardando" | "enviando" | "enviada" | "respondida" | "cancelada" | "falhou";

export interface LinhaDoControle {
  id: string;
  conversation_id: string;
  cliente: string;
  telefone: string | null;
  body: string;
  send_at: string;
  cancel_on_reply: boolean;
  status: string;
  situacao: SituacaoDaProgramada;
  motivo: string | null;
  programada_por: string | null;
  programada_em: string;
  enviada_em: string | null;
}

interface Linha {
  id: string;
  conversation_id: string;
  body: string;
  send_at: string;
  cancel_on_reply: boolean;
  status: string;
  created_by_user_id: string | null;
  created_at: string;
  processed_at: string | null;
  canceled_reason: string | null;
  error: string | null;
}

export async function GET(_req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "scheduled_messages" });
  if (!authz.ok) return authz.response;
  const { org } = authz;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("scheduled_messages")
    .select("id, conversation_id, body, send_at, cancel_on_reply, status, created_by_user_id, created_at, processed_at, canceled_reason, error")
    .eq("organization_id", org.orgId)
    .order("send_at", { ascending: false })
    .limit(LIMITE);
  if (error) return ok({ linhas: [], tabela_ausente: true }, { requestId });

  const linhas = (data ?? []) as Linha[];
  const idsDeConversa = [...new Set(linhas.map((l) => l.conversation_id))];
  const porConversa = new Map<string, { nome: string; telefone: string | null; ultimaRecebida: string | null }>();
  if (idsDeConversa.length > 0) {
    const { data: conversas } = await supabase
      .from("conversations")
      .select("id, last_inbound_at, contacts:contact_id(name, phone_number)")
      .eq("organization_id", org.orgId)
      .in("id", idsDeConversa);
    for (const c of (conversas ?? []) as unknown as Array<{ id: string; last_inbound_at: string | null; contacts: { name: string | null; phone_number: string | null } | { name: string | null; phone_number: string | null }[] | null }>) {
      const contato = Array.isArray(c.contacts) ? c.contacts[0] : c.contacts;
      porConversa.set(c.id, {
        nome: rotuloDoContatoParaEquipe(contato?.name ?? null, contato?.phone_number ?? null),
        telefone: contato?.phone_number ?? null,
        ultimaRecebida: c.last_inbound_at,
      });
    }
  }

  // Nome de quem programou (o endpoint admin do GoTrue é o único que devolve o nome; falha vira "—", nunca derruba a lista).
  const nomes = new Map<string, string>();
  try {
    const { nomesDosAtendentes } = await import("@/lib/users/nome-do-atendente");
    const mapa = await nomesDosAtendentes([...new Set(linhas.map((l) => l.created_by_user_id).filter((v): v is string => Boolean(v)))]);
    for (const [id, nome] of mapa) if (nome) nomes.set(id, nome);
  } catch {
    /* sem nomes */
  }

  const saida: LinhaDoControle[] = linhas.map((l) => {
    const conversa = porConversa.get(l.conversation_id);
    const respondeu =
      l.status === "sent" && !!l.processed_at && !!conversa?.ultimaRecebida && Date.parse(conversa.ultimaRecebida) > Date.parse(l.processed_at);
    const situacao: SituacaoDaProgramada =
      l.status === "pending" ? "aguardando"
      : l.status === "sending" ? "enviando"
      : l.status === "sent" ? (respondeu ? "respondida" : "enviada")
      : l.status === "canceled" ? "cancelada"
      : "falhou";
    const motivo =
      l.status === "canceled" ? (l.canceled_reason === "cliente_respondeu" ? "O cliente respondeu antes do horário" : "Cancelada por uma pessoa")
      : l.status === "failed" ? (l.error ?? "Não foi enviada")
      : null;
    return {
      id: l.id,
      conversation_id: l.conversation_id,
      cliente: conversa?.nome ?? "Cliente",
      telefone: conversa?.telefone ?? null,
      body: l.body,
      send_at: l.send_at,
      cancel_on_reply: l.cancel_on_reply,
      status: l.status,
      situacao,
      motivo,
      programada_por: l.created_by_user_id ? (nomes.get(l.created_by_user_id) ?? null) : null,
      programada_em: l.created_at,
      enviada_em: l.status === "sent" ? l.processed_at : null,
    };
  });
  return ok({ linhas: saida, tabela_ausente: false }, { requestId });
}
