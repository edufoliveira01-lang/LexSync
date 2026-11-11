/**
 * Fork Sales — os documentos que o CLIENTE manda pelo chat (fase 2 do Dropbox).
 *
 * O agente classifica (tipo + título curto) e o sistema entrega: gera um link temporário do arquivo (o Sales baixa sozinho) e pede ao Sales que o guarde
 * no drive do escritório — depois da assinatura do contrato, na pasta do cliente. A pasta, o nome do arquivo e o envio são do SISTEMA (Sales); a IA só
 * diz de que tipo é o documento. O alvo é sempre o contato do turno.
 */
import { createAdminClient } from "@/lib/supabase/admin";

import { enviarDocumentoDoChat, ErroContratoSales, type SituacaoDoDocumentoNoSales } from "./contratos";
import { slugDaOrg } from "./contrato-na-conversa";

/** As pastas de tipo que o agente pode escolher para o que o cliente manda (os contratos assinados vão por outro caminho, do ZapSign). */
export const TIPOS_DE_DOCUMENTO_DO_CHAT = ["PARTE MÉDICA", "DOCUMENTOS PESSOAIS", "DOCUMENTOS ADMINISTRATIVO", "A CLASSIFICAR"] as const;
export type TipoDeDocumentoDoChat = (typeof TIPOS_DE_DOCUMENTO_DO_CHAT)[number];

const BUCKET = "whatsapp-media";
/** O link vale pouco: só o tempo de o Sales baixar. */
const VALIDADE_DO_LINK_S = 600;
const TIPOS_DE_MENSAGEM_COM_DOCUMENTO = ["image", "document"];

export interface DocumentoRecebido {
  referencia: string; tipo_de_arquivo: string; nome_do_arquivo: string; recebido_em: string | null;
  /** `false` quando o arquivo ainda está chegando ao armazenamento: salve de novo no próximo turno. */
  disponivel: boolean;
}

interface LinhaDeMensagem {
  id: string; type: string; media_storage_path: string | null; media_mime: string | null; sent_at: string | null; created_at: string | null;
  metadata: Record<string, unknown> | null;
}

/** A extensão do arquivo, pelo nome (quando há) ou pelo tipo MIME. */
export function extensaoDoArquivo(nome: string | null | undefined, mime: string | null | undefined): string {
  const doNome = /\.([a-z0-9]{1,8})$/i.exec(String(nome ?? ""))?.[1]?.toLowerCase();
  if (doNome) return doNome;
  const m = String(mime ?? "").toLowerCase();
  if (m.includes("pdf")) return "pdf";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("wordprocessingml")) return "docx";
  if (m.includes("msword")) return "doc";
  return "pdf";
}

const jaSalvo = (m: LinhaDeMensagem) => Boolean((m.metadata as { sales_documento?: unknown } | null)?.sales_documento);

/** Mensagens do cliente com arquivo, da conversa do contato, ainda não salvas no drive. */
async function mensagensComDocumento(orgId: string, conversationId: string): Promise<LinhaDeMensagem[]> {
  const { data } = await createAdminClient()
    .from("messages")
    .select("id, type, media_storage_path, media_mime, sent_at, created_at, metadata")
    .eq("organization_id", orgId)
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .in("type", TIPOS_DE_MENSAGEM_COM_DOCUMENTO)
    .order("sent_at", { ascending: true })
    .limit(60);
  return (data ?? []) as unknown as LinhaDeMensagem[];
}

export async function listarDocumentosRecebidos(orgId: string, conversationId: string): Promise<DocumentoRecebido[]> {
  return (await mensagensComDocumento(orgId, conversationId))
    .filter((m) => !jaSalvo(m))
    .map((m) => ({
      referencia: m.id,
      tipo_de_arquivo: m.type === "image" ? "imagem" : "documento",
      nome_do_arquivo: String((m.metadata as { media_filename?: unknown } | null)?.media_filename ?? ""),
      recebido_em: m.sent_at ?? m.created_at,
      disponivel: Boolean(m.media_storage_path),
    }));
}

export interface ResultadoDoSalvamento {
  situacao: SituacaoDoDocumentoNoSales | "nao_encontrado" | "sem_arquivo" | "sem_sales";
  mensagem?: string;
}

/**
 * Salva UM documento recebido. A referência precisa ser de uma mensagem DO CLIENTE, DESTA conversa, com arquivo: o modelo não escolhe mensagem de
 * outra pessoa. Marca a mensagem como salva (o mesmo documento não é oferecido de novo) e devolve a situação que o Sales respondeu.
 */
export async function salvarDocumentoRecebido(a: {
  orgId: string; conversationId: string; referencia: string; tipo: TipoDeDocumentoDoChat; titulo: string; telefone: string | null; cpf: string | null;
  http?: typeof fetch;
}): Promise<ResultadoDoSalvamento> {
  const m = (await mensagensComDocumento(a.orgId, a.conversationId)).find((x) => x.id === a.referencia);
  if (!m) return { situacao: "nao_encontrado" };
  if (jaSalvo(m)) return { situacao: "ja_recebido" };
  if (!m.media_storage_path) return { situacao: "sem_arquivo", mensagem: "O arquivo ainda está chegando ao sistema. Tente salvar de novo no próximo turno." };
  const slug = await slugDaOrg(a.orgId);
  if (!slug) return { situacao: "sem_sales" };

  const admin = createAdminClient();
  const { data: link, error } = await admin.storage.from(BUCKET).createSignedUrl(m.media_storage_path, VALIDADE_DO_LINK_S);
  if (error || !link?.signedUrl) return { situacao: "sem_arquivo", mensagem: "O arquivo ainda não está disponível para cópia." };

  const nome = String((m.metadata as { media_filename?: unknown } | null)?.media_filename ?? "");
  let r: { situacao: SituacaoDoDocumentoNoSales };
  try {
    r = await enviarDocumentoDoChat(slug, {
      origem_ref: m.id, tipo: a.tipo, titulo: a.titulo, extensao: extensaoDoArquivo(nome, m.media_mime), url: link.signedUrl,
      ...(a.telefone ? { telefone: a.telefone } : {}), ...(a.cpf ? { cpf: a.cpf } : {}), ...((m.sent_at ?? m.created_at) ? { data: String(m.sent_at ?? m.created_at) } : {}),
    }, a.http);
  } catch (e) {
    if (e instanceof ErroContratoSales) return { situacao: "sem_sales", mensagem: e.message };
    throw e;
  }
  // Marca como salvo (menos quando o escritório não usa drive: aí nada foi guardado e não faz sentido marcar).
  if (r.situacao !== "drive_nao_configurado") {
    await admin
      .from("messages")
      .update({ metadata: { ...(m.metadata ?? {}), sales_documento: { tipo: a.tipo, titulo: a.titulo, situacao: r.situacao, em: new Date().toISOString() } } })
      .eq("id", m.id)
      .eq("organization_id", a.orgId);
  }
  return { situacao: r.situacao };
}
