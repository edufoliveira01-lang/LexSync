/**
 * "DE ONDE VÊM OS TOKENS DE ENTRADA" — a medida, por turno, do que vai para o modelo.
 *
 * O custo de um agente aparecia só como um número (`tokens_in`), sem dizer se pesava o texto do agente, as definições das ferramentas
 * ou a conversa. Medido a mão num agente real (14/11/2026): ~46 mil tokens por resposta, dos quais o texto do agente é ~9 mil e as
 * ferramentas ~10 mil. Esta função devolve as partes, para o log do turno mostrar onde está o peso. É só medida: não muda o que é enviado,
 * nunca lança, e é barata (um `JSON.stringify` por ferramenta).
 */

/** Aproximação para português: ~3,3 caracteres por token. Serve para comparar partes, não para cobrar. */
export const CARACTERES_POR_TOKEN = 3.3;

export interface ComposicaoDoPrompt {
  sistema_tokens: number;
  mensagens_tokens: number;
  ferramentas: number;
  ferramentas_tokens: number;
  /** As ferramentas mais pesadas, para saber o que enxugar primeiro. */
  maiores_ferramentas: Array<{ nome: string; tokens: number }>;
  total_tokens: number;
}

const tokens = (chars: number): number => Math.round(chars / CARACTERES_POR_TOKEN);

function tamanhoDe(valor: unknown): number {
  try {
    if (valor === undefined || valor === null) return 0;
    if (typeof valor === 'string') return valor.length;
    return JSON.stringify(valor)?.length ?? 0;
  } catch {
    return 0;
  }
}

export function medirComposicaoDoPrompt(p: { system: string; messages: readonly unknown[]; tools: Record<string, unknown> }): ComposicaoDoPrompt {
  try {
    const porFerramenta = Object.entries(p.tools).map(([nome, def]) => {
      const d = def as { description?: unknown; inputSchema?: unknown; parameters?: unknown } | null;
      // O esquema pode ser um objeto zod (JSON.stringify cai no campo interno) ou já JSON Schema; o que importa é a ordem de grandeza.
      const chars = tamanhoDe(d?.description) + tamanhoDe(d?.inputSchema ?? d?.parameters) + nome.length;
      return { nome, tokens: tokens(chars) };
    });
    const ferramentasTokens = porFerramenta.reduce((s, f) => s + f.tokens, 0);
    const sistemaTokens = tokens(p.system.length);
    const mensagensTokens = tokens(tamanhoDe(p.messages));
    return {
      sistema_tokens: sistemaTokens,
      mensagens_tokens: mensagensTokens,
      ferramentas: porFerramenta.length,
      ferramentas_tokens: ferramentasTokens,
      maiores_ferramentas: [...porFerramenta].sort((a, b) => b.tokens - a.tokens).slice(0, 5),
      total_tokens: sistemaTokens + mensagensTokens + ferramentasTokens,
    };
  } catch {
    return { sistema_tokens: 0, mensagens_tokens: 0, ferramentas: 0, ferramentas_tokens: 0, maiores_ferramentas: [], total_tokens: 0 };
  }
}
