/**
 * Como o atendimento aparece escrito para a equipe e para o cliente: "qui., 20/11, às 14h30", sempre no fuso em que a agenda mede o horário.
 * Pura e sem dependência: serve à cápsula do chat (servidor) e à tela de agendar (navegador).
 */
import { diaLocalISO } from "@/lib/agenda/fuso";

const TAG = "pt-BR";

function partes(d: Date, fuso: string) {
  const f = new Intl.DateTimeFormat(TAG, { timeZone: fuso, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const m = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  return { dia: `${m.day}/${m.month}`, semana: String(m.weekday ?? ""), hora: String(m.hour === "24" ? "00" : m.hour), minuto: String(m.minute) };
}

/** "14h" ou "14h30". */
export function horaCurta(inicio: string | Date, fuso: string): string {
  const p = partes(new Date(inicio), fuso);
  return `${p.hora}h${p.minuto === "00" ? "" : p.minuto}`;
}

/** "qui., 20/11, às 14h30". */
export function quandoLegivel(inicio: string | Date, fuso: string): string {
  const d = new Date(inicio);
  const p = partes(d, fuso);
  return `${p.semana}, ${p.dia}, às ${horaCurta(d, fuso)}`;
}

export interface HorarioLivre { inicio: string; fim: string }
export interface DiaDeHorarios { dia: string; rotulo: string; horarios: { inicio: string; rotulo: string }[] }

/**
 * Os horários livres agrupados por DIA no fuso da regra, na ordem do tempo. O rótulo do dia é "Hoje", "Amanhã" ou "qui., 20/11".
 * `maxDias` limita quantos dias entram; `maxPorDia` limita os horários de cada um (a tela mostra uma amostra, e o calendário abre os outros).
 */
export function agruparPorDia(slots: readonly HorarioLivre[], fuso: string, agora: Date, opcoes: { maxDias?: number; maxPorDia?: number } = {}): DiaDeHorarios[] {
  const maxDias = opcoes.maxDias ?? 3;
  const maxPorDia = opcoes.maxPorDia ?? 8;
  const hoje = diaLocalISO(agora, fuso);
  const amanha = diaLocalISO(new Date(agora.getTime() + 24 * 3_600_000), fuso);
  const porDia = new Map<string, DiaDeHorarios>();
  for (const s of [...slots].sort((a, b) => a.inicio.localeCompare(b.inicio))) {
    const d = new Date(s.inicio);
    const dia = diaLocalISO(d, fuso);
    let g = porDia.get(dia);
    if (!g) {
      if (porDia.size >= maxDias) continue;
      const p = partes(d, fuso);
      g = { dia, rotulo: dia === hoje ? "Hoje" : dia === amanha ? "Amanhã" : `${p.semana}, ${p.dia}`, horarios: [] };
      porDia.set(dia, g);
    }
    if (g.horarios.length < maxPorDia) g.horarios.push({ inicio: s.inicio, rotulo: horaCurta(d, fuso) });
  }
  return [...porDia.values()];
}

/** A mensagem de confirmação que vai ao cliente pelo WhatsApp (a equipe vê e pode editar antes de agendar). */
export function textoDaConfirmacao(a: { nome: string | null; tipo: string; inicio: string; fuso: string; local?: string | undefined }): string {
  const primeiro = (a.nome ?? "").trim().split(/\s+/)[0] ?? "";
  const saudacao = primeiro ? `Olá, ${primeiro}!` : "Olá!";
  const quando = quandoLegivel(a.inicio, a.fuso);
  const onde = a.local ? ` Local: ${a.local}.` : "";
  return `${saudacao} Seu atendimento (${a.tipo.toLowerCase()}) está agendado para ${quando}.${onde} Se precisar remarcar, é só responder por aqui.`;
}
