import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { MensagensProgramadasTela } from "./_components/MensagensProgramadasTela";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mensagens programadas" };

export default async function MensagensProgramadasPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  return <MensagensProgramadasTela />;
}
