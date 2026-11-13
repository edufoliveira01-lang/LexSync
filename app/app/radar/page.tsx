import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { RadarTela } from "./_components/RadarTela";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Radar" };

export default async function RadarPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  return <RadarTela />;
}
