/**
 * Cron `scheduled-messages` — dispara a rodada que envia as mensagens programadas do Inbox que já venceram.
 * A lógica mora em `lib/mensagens-programadas/enviar-vencidas.ts` (a mesma que a rodada própria do servidor usa).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { autorizaCron } from "@/lib/auth/cron-auth";
import { logger } from "@/lib/logger";
import { enviarMensagensProgramadasVencidas } from "@/lib/mensagens-programadas/enviar-vencidas";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  if (!autorizaCron(req)) return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  try {
    return ok(await enviarMensagensProgramadasVencidas(requestId), { requestId });
  } catch (err) {
    logger.error("[scheduled-messages] rodada falhou", { error: err instanceof Error ? err.message : String(err), requestId });
    return fail("internal_error", "Failed to process scheduled messages.", 500, { requestId });
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  return handle(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  return handle(req);
}
