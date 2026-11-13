import { notFound } from "next/navigation";

import { ContactsListClient } from "@/app/app/contacts/_client";

/** Telas disponíveis no preview. Cada uma é o componente REAL da tela; os dados vêm do mock de rede. */
const TELAS: Record<string, () => React.ReactNode> = {
  contacts: () => <ContactsListClient />,
};

export default async function DevPreviewPage({ params }: { params: Promise<{ tela: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { tela } = await params;
  const montar = TELAS[tela];
  if (!montar) notFound();
  return montar();
}
