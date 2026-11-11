import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";

import { lerCentralDeNotificacoes } from "./_actions";
import { CentralDeNotificacoes } from "./_client";

export const dynamic = "force-dynamic";

export default async function NotificacoesDaEquipePage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  if (ROLE_RANK[org.role] < ROLE_RANK.manager) redirect("/app");
  const estado = await lerCentralDeNotificacoes();
  if (!estado.ok) redirect("/app");
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Notificações da equipe</h1>
        <p className="text-sm text-text-muted">
          Avisos por WhatsApp para a sua equipe: quando o agente passar para um atendente, quando o contrato for enviado ou assinado, ou quando o Roteiro chamar.
        </p>
      </header>
      <CentralDeNotificacoes inicial={estado} />
    </div>
  );
}
