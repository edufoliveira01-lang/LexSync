import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { phoneLookupVariants } from "@/lib/channels/phone-variants";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Abrir conversa" };

/**
 * Fork Sales — «Abrir a conversa deste cliente»: o Sales (lista e ficha do cliente) manda o telefone; aqui achamos a conversa mais recente
 * desse número NESTA organização e abrimos a caixa de entrada nela. Sem conversa, avisa em vez de abrir uma tela vazia.
 * A leitura usa a sessão da pessoa (RLS): outra organização nunca aparece.
 */
export default async function AbrirConversaPage({ searchParams }: { searchParams: Promise<{ telefone?: string }> }) {
  const user = await loadAuthUser();
  if (!user) redirect("/login");
  const org = await resolveActiveOrg(user);
  const { telefone } = await searchParams;
  const digitos = String(telefone ?? "").replace(/\D/g, "").slice(0, 15);
  if (!org || digitos.length < 8) redirect("/app/inbox");

  const db = await createClient();
  const variantes = phoneLookupVariants(digitos);
  const { data: contatos } = await db.from("contacts").select("id").eq("organization_id", org.orgId).in("phone_number", variantes).limit(5);
  const ids = ((contatos ?? []) as Array<{ id: string }>).map((c) => c.id);
  if (ids.length > 0) {
    const { data: conversa } = await db.from("conversations").select("id").eq("organization_id", org.orgId).in("contact_id", ids)
      .order("last_inbound_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
    const id = (conversa as { id: string } | null)?.id;
    if (id) redirect(`/app/inbox?id=${encodeURIComponent(id)}`);
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
      <p>Ainda não existe conversa no atendimento com o número <b>{digitos}</b>.</p>
      <p>Quando essa pessoa enviar uma mensagem (ou você iniciar uma conversa), ela aparece na caixa de entrada.</p>
      <Link className="text-primary underline underline-offset-4" href="/app/inbox">Ir para a caixa de entrada</Link>
    </div>
  );
}
