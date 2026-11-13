"use client";

import { format } from "date-fns";

import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";
import { textoDoEvento } from "@/lib/inbox/evento-na-conversa-marca";
import type { Note } from "@/lib/types/messaging";

/** Fork Sales — linha centralizada: "Fulano assumiu / transferiu / fechou a conversa". */
export function EventoDaConversa({ note }: { note: Note }) {
  useLocaleDeData();
  return (
    <div
      data-testid="evento-da-conversa"
      className="my-2 flex items-center justify-center gap-2 px-4 text-[12px] text-text-muted"
    >
      <span className="max-w-[80%] truncate rounded-full bg-muted px-3 py-1 text-center">
        {textoDoEvento(note.body)} · {format(new Date(note.created_at), "dd/MM HH:mm")}
      </span>
    </div>
  );
}
