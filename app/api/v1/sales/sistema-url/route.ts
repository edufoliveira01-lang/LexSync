import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { enderecoDoSistemaDoEscritorio } from "@/lib/sales/sistema-url";
import { configDosContratos } from "@/lib/sales/contratos";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "organizations" });
  if (!authz.ok) return authz.response;
  const cfg = configDosContratos();
  if (!cfg) return ok({ url: null }, { requestId });
  const { data: org } = await createAdminClient().from("organizations").select("slug").eq("id", authz.org.orgId).maybeSingle();
  const slug = (org as { slug: string | null } | null)?.slug;
  return ok({ url: slug ? enderecoDoSistemaDoEscritorio(cfg.url, slug) : null }, { requestId });
}
