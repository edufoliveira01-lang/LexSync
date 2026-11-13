import { cn } from "@/lib/utils";

const CORES = [
  "bg-accent-100 text-accent-800",
  "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-sky-100 text-sky-800",
  "bg-fuchsia-100 text-fuchsia-800",
];

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "?") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

function indiceDe(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % CORES.length;
}

/** As iniciais num círculo colorido, como no Sales; a cor sai do id, então é sempre a mesma por pessoa. */
export function AvatarDoContato({ id, nome, tamanho = 40, className }: { id: string; nome: string; tamanho?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.38) }}
      className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold", CORES[indiceDe(id)], className)}
    >
      {iniciais(nome)}
    </span>
  );
}
