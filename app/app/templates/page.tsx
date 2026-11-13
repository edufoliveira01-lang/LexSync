import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { RespostasRapidasTela } from "./_components/RespostasRapidasTela";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Respostas rápidas" };

export default async function TemplatesPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app/inbox");
  const canShare = ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager;
  return <RespostasRapidasTela canShare={canShare} currentUserId={user.id} />;
}
