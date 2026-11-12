/**
 * GET /api/v1/conversations/[id]/messages — histórico de mensagens (handler
 * em /app/api/v1/messages/_handler.ts → listMessagesHandler).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { resolveAuthDual } from "@/lib/api/auth-dual";
import type { HandlerCtx } from "@/lib/api/handlers/types";
import type { Idioma } from "@/lib/i18n/idiomas";
import { ApiError } from "@/lib/api/types";
import { fail, ok } from "@/lib/api/wrappers";
import { loadAuthUser } from "@/lib/auth/server";
import { orgAtivaDaApi } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { listMessagesQuerySchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

import { listMessagesHandler } from "@/app/api/v1/messages/_handler";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id: conversationId } = await ctx.params;
  // Sessão de navegador OU token de servidor (`dsk_…` com `mcp:read`): o Sales confere respostas e
  // confirmações de leitura das mensagens que enviou. O token só enxerga a própria organização.
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let organizationId: string;
  let actor: HandlerCtx["actor"];
  let idioma: Idioma | undefined;
  if (req.headers.get("authorization")) {
    const authz = await resolveAuthDual(req, { requestId, resource: "messages", role: "agent", scope: "mcp:read" });
    if (!authz.ok) return authz.response;
    supabase = authz.supabase as typeof supabase;
    organizationId = authz.organizationId;
    actor = authz.actor;
    idioma = authz.idioma;
  } else {
    supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      return fail("unauthenticated", "Auth required.", 401, { requestId });
    }
    const authUser = await loadAuthUser();
    const ativa = await orgAtivaDaApi(authUser, requestId);
    if (!ativa.ok) return ativa.response;
    if (!ativa.org) {
      return fail("no_active_org", traduzir("No active organization.", authUser?.idioma ?? "pt-BR"), 403, { requestId });
    }
    organizationId = ativa.org.orgId;
    actor = { type: "user", id: user.id };
    idioma = authUser?.idioma;
  }
  const t = (texto: string) => traduzir(texto, idioma ?? "pt-BR");

  const url = new URL(req.url);
  const qsParsed = listMessagesQuerySchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!qsParsed.success) {
    return fail("validation_failed", t("Query inválida."), 422, {
      details: qsParsed.error.flatten().fieldErrors as Record<string, unknown>,
      requestId,
    });
  }

  try {
    const { messages, cursor, has_more } = await listMessagesHandler(
      supabase,
      {
        organization_id: organizationId,
        actor,
        requestId,
        idioma,
      },
      conversationId,
      qsParsed.data,
    );
    return ok(messages, { requestId, meta: { cursor, has_more } });
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.code, err.message, err.status, { requestId });
    }
    throw err;
  }
}
