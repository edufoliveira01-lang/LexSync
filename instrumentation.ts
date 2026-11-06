import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    // Fork Sales: o servidor confere as assinaturas de contrato (move o negócio, avisa o cliente), mesmo sem ninguém com a caixa de entrada aberta.
    void import("./lib/sales/acompanhar-contratos").then((m) => m.iniciarAcompanhamentoDeContratos()).catch(() => undefined);
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
