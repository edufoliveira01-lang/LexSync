import { createHmac } from "node:crypto";

/**
 * Fork Sales — o servidor de ferramentas (MCP) de cada escritório, no painel do Sales: `POST <SALES_PAINEL_URL>/mcp/<slug>`.
 * A chave sai do segredo que o Deskcomm e o painel já dividem (CONTRATOS_SEGREDO) e do slug: nenhuma chave é copiada à mão.
 * (Mesma conta de `server/src/atendimento/mcp/chave.ts` no Sales.)
 */
export const chaveDoServidorMcp = (segredo: string, slug: string): string => createHmac("sha256", segredo).update(`mcp:${slug}`).digest("hex");
export const enderecoDoServidorMcp = (urlDoPainel: string, slug: string): string => `${urlDoPainel.replace(/\/+$/, "")}/mcp/${encodeURIComponent(slug)}`;

/** As consultas ao cadastro do cliente que o Sales oferece ao agente (todas somente leitura). */
export const FERRAMENTAS_DO_SALES: readonly string[] = ["consultar_cliente", "andamento_do_processo", "proximos_compromissos", "financeiro_do_cliente", "documentos_do_cliente"];
