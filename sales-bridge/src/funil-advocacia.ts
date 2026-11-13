import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * O funil de advocacia como funil PADRÃO de todo escritório novo. A instalação nasce com um funil genérico de loja
 * ("Pedidos": Carrinho abandonado, Pago, Em separação…), que não serve a um escritório; aqui ele é arquivado e o funil
 * "Atendimento jurídico" — o mesmo de `lib/pipelines/modelo-advocacia.ts` do app, já ligado ao agente — passa a ser o padrão.
 *
 * ⚠️ As etapas são uma CÓPIA do app (a ponte é um pacote à parte). `tests/unit/funil-advocacia-da-ponte.test.ts` do app compara
 * as duas listas: se um lado mudar sem o outro, o teste reprova.
 */
type Cliente = Pick<SupabaseClient, "from">;

export const NOME_DO_FUNIL = "Atendimento jurídico";
export const SLUG_DO_FUNIL = "atendimento-juridico";

export const ETAPAS: ReadonlyArray<{ name: string; slug: string; is_won: boolean; is_lost: boolean; agent_stage_hint: string | null }> = [
  { name: "Novo contato", slug: "novo_contato", is_won: false, is_lost: false, agent_stage_hint: "new" },
  { name: "Em triagem", slug: "em_triagem", is_won: false, is_lost: false, agent_stage_hint: "qualifying" },
  { name: "Proposta enviada", slug: "proposta_enviada", is_won: false, is_lost: false, agent_stage_hint: "qualified" },
  { name: "Proposta aceita", slug: "proposta_aceita", is_won: false, is_lost: false, agent_stage_hint: "negotiating" },
  { name: "Contrato enviado", slug: "contrato_enviado", is_won: false, is_lost: false, agent_stage_hint: null },
  { name: "Contrato assinado", slug: "contrato_assinado", is_won: false, is_lost: false, agent_stage_hint: null },
  { name: "Aguardando documentos", slug: "aguardando_documentos", is_won: true, is_lost: false, agent_stage_hint: null },
  { name: "Sem interesse", slug: "sem_interesse", is_won: false, is_lost: true, agent_stage_hint: "lost" },
];

export const CAMPOS_DE_CONTRATO: ReadonlyArray<{ key: string; label: string; type: "text" }> = [
  { key: "cpf", label: "CPF", type: "text" }, { key: "rg", label: "RG", type: "text" },
  { key: "nacionalidade", label: "Nacionalidade", type: "text" }, { key: "estado_civil", label: "Estado civil", type: "text" },
  { key: "profissao", label: "Profissão", type: "text" }, { key: "cep", label: "CEP", type: "text" },
  { key: "logradouro", label: "Logradouro", type: "text" }, { key: "numero", label: "Número", type: "text" },
  { key: "complemento", label: "Complemento", type: "text" }, { key: "bairro", label: "Bairro", type: "text" },
  { key: "cidade", label: "Cidade", type: "text" }, { key: "uf", label: "UF", type: "text" },
];

export type ResultadoDoFunil = "criado" | "ja_existia" | "falhou";

/** Cria o funil de advocacia como padrão do escritório e arquiva o genérico. Nunca lança: o escritório já existe e o funil se cria à mão se isto falhar. */
export async function semearFunilDeAdvocacia(db: Cliente, orgId: string): Promise<ResultadoDoFunil> {
  try {
    const { data: existentes, error } = await db.from("crm_pipelines").select("id, slug, is_archived").eq("organization_id", orgId);
    if (error) return "falhou";
    const lista = (existentes ?? []) as Array<{ id: string; slug: string; is_archived: boolean }>;
    if (lista.some((f) => f.slug === SLUG_DO_FUNIL)) return "ja_existia";

    const novo = await db
      .from("crm_pipelines")
      .insert({
        organization_id: orgId, name: NOME_DO_FUNIL, slug: SLUG_DO_FUNIL, description: "O atendimento do primeiro contato até o contrato assinado.",
        position: 1000, is_default: false, settings: { fields: CAMPOS_DE_CONTRATO.map((c) => ({ ...c })) },
      })
      .select("id")
      .single();
    const pipelineId = (novo.data as { id?: string } | null)?.id;
    if (novo.error || !pipelineId) return "falhou";

    const etapas = await db.from("crm_stages").insert(
      ETAPAS.map((e, i) => ({ organization_id: orgId, pipeline_id: pipelineId, name: e.name, slug: e.slug, position: (i + 1) * 1000, is_won: e.is_won, is_lost: e.is_lost, agent_stage_hint: e.agent_stage_hint })),
    );
    if (etapas.error) {
      await db.from("crm_pipelines").delete().eq("id", pipelineId).eq("organization_id", orgId);
      return "falhou";
    }

    // O genérico sai de cena (um escritório novo ainda não tem negócio nenhum) e o de advocacia vira o padrão.
    for (const antigo of lista.filter((f) => !f.is_archived)) {
      const r = await db.from("crm_pipelines").update({ is_default: false, is_archived: true }).eq("id", antigo.id).eq("organization_id", orgId);
      if (r.error) return "falhou";
    }
    const padrao = await db.from("crm_pipelines").update({ is_default: true }).eq("id", pipelineId).eq("organization_id", orgId);
    return padrao.error ? "falhou" : "criado";
  } catch {
    return "falhou";
  }
}
