/**
 * O dado que o cliente corrige na conversa chega também ao SISTEMA SALES, não só ao contato do Deskcomm.
 *
 * Só vale para quem JÁ É cliente no Sales (o telefone da conversa acha o cadastro). Lead novo não tem cadastro lá: o contrato é que o cria.
 *
 *  - Endereço, e-mail, profissão e estado civil: o Sales atualiza e deixa o histórico (antes → depois) na ficha.
 *  - Nome, CPF, RG, data de nascimento, nome da mãe, nacionalidade e sexo: NÃO mudam por mensagem. Trocar identidade exige a equipe confirmar quem
 *    está pedindo. Viram uma anotação no cadastro do Sales ("Pedido do cliente: alterar …"), com o valor pedido, para a equipe decidir.
 *  - O telefone nunca passa por aqui: é a chave que identifica o cliente.
 *
 * Melhor-esforço e curto (8 s): se o Sales estiver fora, ou ainda sem esta rota, o dado fica no Deskcomm e vira uma anotação no cadastro para a
 * equipe aplicar. Nunca derruba a gravação do Deskcomm.
 */
import { anotarNoSales, atualizarCadastroNoSales, buscarClienteParaAnotar, configDosContratos } from "@/lib/sales/contratos";
import { slugDaOrg } from "@/lib/sales/contrato-na-conversa";

/** Os campos que o Sales troca direto (a mesma lista de `CAMPOS_LIBERADOS` do lado dele). */
export const CAMPOS_DIRETOS_NO_SALES = ["email", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "profissao", "estado_civil"] as const;

const ROTULOS: Record<string, string> = {
  nome: "nome", cpf: "CPF", rg: "RG", data_nascimento: "data de nascimento", nome_da_mae: "nome da mãe", nacionalidade: "nacionalidade", sexo: "sexo",
  email: "e-mail", cep: "CEP", logradouro: "rua", numero: "número", complemento: "complemento", bairro: "bairro", cidade: "cidade", uf: "UF", profissao: "profissão", estado_civil: "estado civil",
};

export type SituacaoNoSales = "atualizado" | "pedido_registrado" | "atualizado_e_pedido_registrado" | "nada_a_fazer" | "nao_e_cliente" | "indisponivel";
export interface ResultadoNoSales { situacao: SituacaoNoSales; atualizados: string[]; pedido_registrado: string[] }

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
/** "Maria" para quem está no Sales como "Maria Souza" não é pedido de troca de nome: é o primeiro nome do mesmo cadastro. */
const nomeCompativel = (novo: string, noSales: string) => {
  const n = semAcento(novo), s = semAcento(noSales);
  return n.length > 0 && (s === n || s.startsWith(`${n} `) || n.startsWith(`${s} `) || s.split(/\s+/).includes(n));
};

/** O fetch com teto curto: a propagação nunca prende o turno do agente. */
const comTeto = ((url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => fetch(url, { ...init, signal: AbortSignal.timeout(8_000) })) as typeof fetch;

export async function propagarCadastroParaOSales(p: {
  organizationId: string;
  telefone: string | null;
  novos: Record<string, string | undefined>;
  http?: typeof fetch;
}): Promise<ResultadoNoSales> {
  const vazio: ResultadoNoSales = { situacao: "nada_a_fazer", atualizados: [], pedido_registrado: [] };
  const http = p.http ?? comTeto;
  const novos = Object.entries(p.novos).filter(([, v]) => typeof v === "string" && v.trim() !== "") as [string, string][];
  if (novos.length === 0 || !p.telefone) return vazio;
  try {
    if (!configDosContratos()) return { ...vazio, situacao: "indisponivel" };
    const slug = await slugDaOrg(p.organizationId);
    if (!slug) return { ...vazio, situacao: "indisponivel" };
    const achou = await buscarClienteParaAnotar(slug, p.telefone, http);
    if (!achou.encontrado || !achou.pessoa) return { ...vazio, situacao: "nao_e_cliente" };

    const diretos = Object.fromEntries(novos.filter(([k]) => (CAMPOS_DIRETOS_NO_SALES as readonly string[]).includes(k)));
    const nomeDoSales = achou.pessoa.nome;
    const protegidos = novos.filter(([k, v]) => !(CAMPOS_DIRETOS_NO_SALES as readonly string[]).includes(k) && !(k === "nome" && nomeCompativel(v, nomeDoSales)));
    const autor = { autor_nome: "Assistente virtual" };

    const atualizados: string[] = [];
    let anotacoes = protegidos.map(([k, v]) => `${ROTULOS[k] ?? k}: ${v}`);
    if (Object.keys(diretos).length > 0) {
      try {
        const r = await atualizarCadastroNoSales(slug, { pessoa_id: achou.pessoa.id, campos: diretos, ...autor }, http);
        atualizados.push(...r.alterados);
        // O que o Sales recusou por valor inválido volta para a equipe como pedido, em vez de sumir.
        for (const k of r.ignorados) if (diretos[k]) anotacoes.push(`${ROTULOS[k] ?? k}: ${diretos[k]}`);
      } catch {
        // Sales fora, ou sem a rota nova: a equipe recebe o pedido inteiro e aplica à mão.
        anotacoes = [...Object.entries(diretos).map(([k, v]) => `${ROTULOS[k] ?? k}: ${v}`), ...anotacoes];
      }
    }

    // Não repete o pedido que já está nas anotações recentes (o agente grava dado a dado).
    const recentes = (achou.recentes ?? []).map((r) => r.texto);
    anotacoes = anotacoes.filter((linha) => !recentes.some((t) => t.includes(linha)));
    const pedido: string[] = [];
    if (anotacoes.length > 0) {
      try {
        await anotarNoSales(slug, { pessoa_id: achou.pessoa.id, texto: `Pedido do cliente pelo atendimento virtual: alterar ${anotacoes.join("; ")}. Aguarda a confirmação da identidade pela equipe antes de mudar o cadastro.`, ...autor, autor_email: "" }, http);
        pedido.push(...anotacoes.map((a) => a.split(":")[0]!));
      } catch { /* sem o Sales: o dado segue no Deskcomm */ }
    }
    const situacao: SituacaoNoSales = atualizados.length > 0 && pedido.length > 0 ? "atualizado_e_pedido_registrado" : atualizados.length > 0 ? "atualizado" : pedido.length > 0 ? "pedido_registrado" : "nada_a_fazer";
    return { situacao, atualizados, pedido_registrado: pedido };
  } catch {
    return { ...vazio, situacao: "indisponivel" };
  }
}
