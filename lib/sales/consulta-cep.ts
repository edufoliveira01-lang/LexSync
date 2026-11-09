/**
 * Fork Sales — consulta de CEP para agilizar a coleta do endereço: o cliente informa o CEP (e o número) e o resto vem do cadastro dos Correios.
 * BrasilAPI primeiro, ViaCEP de reserva. Timeout curto e NUNCA lança: sem resposta, a coleta segue perguntando o endereço por extenso.
 * O `User-Agent` é explícito porque a BrasilAPI recusa o padrão do Node (ver `lib/brasil-api/client.ts`).
 */
const USER_AGENT = "self-hosted-crm/1.0";
const TIMEOUT_MS = 4_000;

export interface EnderecoDoCep { cep: string; logradouro?: string; bairro?: string; cidade?: string; uf?: string }

type Busca = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const txt = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Só os 8 dígitos do CEP, ou `null`. */
export const cepSoDigitos = (cep: string | undefined | null): string | null => {
  const n = String(cep ?? "").replace(/\D/g, "");
  return n.length === 8 ? n : null;
};

async function tenta(busca: Busca, url: string): Promise<Record<string, unknown> | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await busca(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: ctl.signal });
    if (!r.ok) return null;
    const j = await r.json();
    return j && typeof j === "object" ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function consultarCep(cep: string, busca: Busca = fetch as unknown as Busca): Promise<EnderecoDoCep | null> {
  const n = cepSoDigitos(cep);
  if (!n) return null;
  const a = await tenta(busca, `https://brasilapi.com.br/api/cep/v2/${n}`);
  if (a && (txt(a.street) || txt(a.city))) return { cep: n, logradouro: txt(a.street), bairro: txt(a.neighborhood), cidade: txt(a.city), uf: txt(a.state)?.toUpperCase().slice(0, 2) };
  const b = await tenta(busca, `https://viacep.com.br/ws/${n}/json/`);
  if (b && !b.erro && (txt(b.logradouro) || txt(b.localidade))) return { cep: n, logradouro: txt(b.logradouro), bairro: txt(b.bairro), cidade: txt(b.localidade), uf: txt(b.uf)?.toUpperCase().slice(0, 2) };
  return null;
}
