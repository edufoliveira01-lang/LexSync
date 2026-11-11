import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    // Fork Sales: o servidor confere as assinaturas de contrato (move o negócio, avisa o cliente), mesmo sem ninguém com a caixa de entrada aberta.
    void import("./lib/sales/acompanhar-contratos").then((m) => m.iniciarAcompanhamentoDeContratos()).catch(() => undefined);
    // Fork Sales: avisa a equipe por WhatsApp quando o envio dos documentos ao Dropbox dá problema (só orgs com a notificação ativa).
    void import("./lib/sales/vigia-do-armazenamento").then((m) => m.iniciarVigiaDoArmazenamento()).catch(() => undefined);
    // Fork Sales: a base jurídica se atualiza sozinha a partir de fontes oficiais (só liga com BASE_JURIDICA_AUTO=1 e a chave definida).
    void import("./lib/sales/base-juridica/atualizar").then((m) => m.iniciarAtualizacaoDaBaseJuridica()).catch(() => undefined);
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
