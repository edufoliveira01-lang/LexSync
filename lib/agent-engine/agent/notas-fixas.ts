/**
 * Notas FIXAS do atendimento — memória que não depende de o modelo lembrar de gravar nem de reconsultar.
 *
 * O contexto de cada resposta da IA é pequeno (as últimas mensagens + o índice de notas). Dois tipos de fato se perdiam:
 *   1. O que a base jurídica disse (requisitos, quando cabe, quando não cabe, prazos). Só existia no resultado da consulta daquela
 *      resposta; na seguinte a IA precisava consultar de novo — e, se não o fizesse, respondia de memória.
 *   2. O que a pessoa respondeu a cada pergunta da triagem. Passadas as últimas mensagens, as respostas do começo saíam do contexto e
 *      a IA voltava a perguntar o que já sabia, ou concluía a triagem sem as respostas.
 *
 * Aqui os dois viram notas do contato (`lead_notes`), gravadas pelo SISTEMA (não pelo modelo), e o corpo delas entra SEMPRE no contexto
 * (`blocoDasNotasFixas`), com teto de tamanho — não só o índice, que pede uma chamada a `get_lead_note`.
 *
 * - `FICHA DO BENEFÍCIO — <título>`: uma por tema consultado (regravada se a ficha mudar).
 * - `REGISTRO DA TRIAGEM`: perguntas da IA e respostas do cliente, em ordem. Cresce até ~3.500 caracteres; então vira
 *   `REGISTRO DA TRIAGEM — parte N` (guardada) e começa outra.
 *
 * Nunca lança: falha aqui vira log e o turno segue.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Queryable } from '../queue/queue';

export const PREFIXO_FICHA = 'FICHA DO BENEFÍCIO —';
export const PREFIXO_REGISTRO = 'REGISTRO DA TRIAGEM';

const LIMITE_DO_REGISTRO = 3_500;
const LIMITE_DA_FICHA = 4_200;
/** Teto, em caracteres, do que as notas fixas somam no contexto de UMA resposta (≈ 2.500 tokens). */
const TETO_NO_CONTEXTO = 9_000;

export interface FichaParaNota {
  titulo: string;
  resumo: string;
  requisitos: readonly string[];
  quando_nao_cabe?: readonly string[];
  quando_ha_duvida?: readonly string[];
  perguntas_que_faltam: readonly string[];
  prazos: readonly string[];
  cuidados: readonly string[];
  alegacoes_comuns_do_inss?: readonly string[];
  teses_e_flexibilizacoes?: readonly string[];
  fontes: readonly { titulo: string; url: string }[];
  revisado_em: string;
  status: string;
}

function lista(titulo: string, itens: readonly string[] | undefined): string {
  if (!itens || itens.length === 0) return '';
  return `${titulo}:\n${itens.map((i) => `- ${i}`).join('\n')}\n`;
}

/** O texto da ficha, na ordem do que mais decide o caso. Passou do teto: corta o que decide menos (do fim para o começo). */
export function textoDaFicha(f: FichaParaNota): string {
  const partes = [
    `${f.titulo}\n${f.resumo}\n`,
    lista('REQUISITOS', f.requisitos),
    lista('QUANDO NÃO CABE (confira com o que a pessoa contou)', f.quando_nao_cabe),
    lista('QUANDO HÁ DÚVIDA (segue com ressalva; o advogado confere)', f.quando_ha_duvida),
    lista('PERGUNTAS QUE FALTAM (candidatas)', f.perguntas_que_faltam),
    lista('PRAZOS', f.prazos),
    lista('CUIDADOS', f.cuidados),
    lista('O QUE O INSS COSTUMA ALEGAR', f.alegacoes_comuns_do_inss),
    lista('TESES E FLEXIBILIZAÇÕES', f.teses_e_flexibilizacoes),
    `Fonte: ${f.fontes.map((x) => x.titulo).join('; ')} · revisada em ${f.revisado_em}${f.status === 'pendente_revisao' ? ' · ainda sem conferência de advogado: o advogado confirma' : ''}`,
  ].filter(Boolean);
  let texto = partes.join('\n');
  // Corta blocos inteiros do fim (menos decisivos) antes de cortar no meio de um requisito.
  while (texto.length > LIMITE_DA_FICHA && partes.length > 5) {
    partes.splice(partes.length - 2, 1);
    texto = partes.join('\n');
  }
  return texto.slice(0, LIMITE_DA_FICHA);
}

export function cabecalhoDaFicha(titulo: string): string {
  return `${PREFIXO_FICHA} ${titulo}`.slice(0, 200);
}

/** Grava (ou regrava) a nota da ficha para o contato. Idempotente: a mesma ficha não cria nota nova. */
export async function gravarFichaNaNota(
  db: Queryable,
  ids: { tenantId: string; contactId: string },
  ficha: FichaParaNota,
): Promise<void> {
  const headline = cabecalhoDaFicha(ficha.titulo);
  const body = textoDaFicha(ficha);
  const { rows } = await db.query<{ id: string; body: string }>(
    'select id, body from lead_notes where organization_id = $1 and contact_id = $2 and headline = $3 limit 1',
    [ids.tenantId, ids.contactId, headline],
  );
  const atual = rows[0];
  if (atual) {
    if (atual.body === body) return;
    await db.query('update lead_notes set body = $2, updated_at = now() where id = $1', [atual.id, body]);
    return;
  }
  await db.query('insert into lead_notes (organization_id, contact_id, headline, body) values ($1, $2, $3, $4)', [
    ids.tenantId,
    ids.contactId,
    headline,
    body,
  ]);
}

/** O mesmo que `gravarFichaNaNota`, para quem só tem o cliente do Supabase (as ferramentas MCP). Melhor esforço: nunca lança. */
export async function gravarFichaNaNotaSupabase(
  admin: SupabaseClient,
  ids: { tenantId: string; contactId: string },
  ficha: FichaParaNota,
): Promise<void> {
  try {
    const headline = cabecalhoDaFicha(ficha.titulo);
    const body = textoDaFicha(ficha);
    const { data } = await admin
      .from('lead_notes')
      .select('id, body')
      .eq('organization_id', ids.tenantId)
      .eq('contact_id', ids.contactId)
      .eq('headline', headline)
      .limit(1)
      .maybeSingle();
    const atual = data as { id: string; body: string } | null;
    if (atual) {
      if (atual.body !== body) await admin.from('lead_notes').update({ body, updated_at: new Date().toISOString() }).eq('id', atual.id);
      return;
    }
    await admin.from('lead_notes').insert({ organization_id: ids.tenantId, contact_id: ids.contactId, headline, body });
  } catch {
    // a ficha continua na resposta da ferramenta; só a cópia na nota deixou de ser gravada
  }
}

/** A última frase com "?" do texto — a pergunta que a IA fez. */
export function ultimaPergunta(texto: string): string | null {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  if (!limpo.includes('?')) return null;
  const frases = limpo.split(/(?<=[.!?])\s+/).filter((s) => s.includes('?'));
  const f = frases[frases.length - 1];
  return f ? f.slice(0, 220) : null;
}

interface Estado {
  ate: string;
  pergunta: string | null;
}

const RE_ESTADO = /^#ate=(\S+)(?:\|p=(.*))?$/;

function lerEstado(body: string): { estado: Estado | null; linhas: string } {
  const [primeira = '', ...resto] = body.split('\n');
  const m = RE_ESTADO.exec(primeira);
  if (!m) return { estado: null, linhas: body };
  return { estado: { ate: m[1]!, pergunta: m[2] ? m[2] : null }, linhas: resto.join('\n') };
}

function montarCorpo(estado: Estado, linhas: string): string {
  return `#ate=${estado.ate}|p=${estado.pergunta ?? ''}\n${linhas}`;
}

function hora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const f = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  return f.replace(',', '');
}

interface LinhaDeMensagem {
  direction: string;
  body: string | null;
  sent_at: string;
}

/**
 * Anota, na ordem, cada pergunta da IA e o que o cliente respondeu. Lê só o que chegou depois da última anotação (marca no corpo da nota),
 * então chamar duas vezes não duplica. O que o cliente escreveu depois da última resposta da IA espera o turno seguinte.
 */
export async function registrarPerguntasERespostas(
  db: Queryable,
  ids: { tenantId: string; contactId: string },
): Promise<{ anotadas: number }> {
  const { rows: ativas } = await db.query<{ id: string; body: string }>(
    `select id, body from lead_notes where organization_id = $1 and contact_id = $2 and headline = $3 limit 1`,
    [ids.tenantId, ids.contactId, PREFIXO_REGISTRO],
  );
  const nota = ativas[0];
  const { estado: estadoAnterior, linhas: linhasAnteriores } = nota ? lerEstado(nota.body) : { estado: null, linhas: '' };
  const ate = estadoAnterior?.ate ?? '1970-01-01T00:00:00Z';

  const { rows: mensagens } = await db.query<LinhaDeMensagem>(
    `select direction, body, sent_at::text as sent_at
       from messages
      where organization_id = $1 and contact_id = $2 and sent_at > $3::timestamptz
        and body is not null and length(btrim(body)) > 0
      order by sent_at, id
      limit 200`,
    [ids.tenantId, ids.contactId, ate],
  );
  if (mensagens.length === 0) return { anotadas: 0 };

  let pergunta = estadoAnterior?.pergunta ?? null;
  let respostas: string[] = [];
  let primeiraResposta: string | null = null;
  let novoAte = ate;
  const novas: string[] = [];
  for (const m of mensagens) {
    const texto = (m.body ?? '').replace(/\s+/g, ' ').trim();
    if (m.direction === 'inbound') {
      if (respostas.length === 0) primeiraResposta = m.sent_at;
      respostas.push(texto);
      continue;
    }
    if (respostas.length > 0) {
      novas.push(`[${hora(primeiraResposta ?? m.sent_at)}] P: ${pergunta ?? '—'}\nR: ${respostas.join(' / ').slice(0, 400)}`);
      respostas = [];
      primeiraResposta = null;
    }
    const q = ultimaPergunta(texto);
    if (q) pergunta = q;
    novoAte = m.sent_at;
  }
  // `respostas` que sobraram (sem resposta da IA ainda) não são consumidas: `novoAte` não passou delas.
  if (novas.length === 0 && novoAte === ate) return { anotadas: 0 };

  const estado: Estado = { ate: novoAte, pergunta };
  const juntas = [linhasAnteriores.trim(), ...novas].filter(Boolean).join('\n');

  if (!nota) {
    await db.query('insert into lead_notes (organization_id, contact_id, headline, body) values ($1, $2, $3, $4)', [
      ids.tenantId,
      ids.contactId,
      PREFIXO_REGISTRO,
      montarCorpo(estado, juntas || '(sem respostas ainda)'),
    ]);
    return { anotadas: novas.length };
  }
  if (juntas.length > LIMITE_DO_REGISTRO) {
    // A nota ativa fecha como "parte N" (sem a marca de estado) e a pergunta/resposta nova abre outra.
    const { rows: partes } = await db.query<{ n: string }>(
      'select count(*)::text as n from lead_notes where organization_id = $1 and contact_id = $2 and headline like $3',
      [ids.tenantId, ids.contactId, `${PREFIXO_REGISTRO} — parte %`],
    );
    const numero = Number(partes[0]?.n ?? '0') + 1;
    await db.query('update lead_notes set headline = $2, body = $3, updated_at = now() where id = $1', [
      nota.id,
      `${PREFIXO_REGISTRO} — parte ${numero}`,
      linhasAnteriores.trim() || '(vazio)',
    ]);
    await db.query('insert into lead_notes (organization_id, contact_id, headline, body) values ($1, $2, $3, $4)', [
      ids.tenantId,
      ids.contactId,
      PREFIXO_REGISTRO,
      montarCorpo(estado, novas.join('\n') || '(continua)'),
    ]);
    return { anotadas: novas.length };
  }
  await db.query('update lead_notes set body = $2, updated_at = now() where id = $1', [nota.id, montarCorpo(estado, juntas)]);
  return { anotadas: novas.length };
}

/**
 * O bloco que entra SEMPRE no contexto: o registro da triagem (inteiro, partes antigas primeiro) e as fichas consultadas. Sem notas fixas
 * devolve ''. Se passar do teto, mantém o registro mais recente e as fichas mais recentes.
 */
export async function blocoDasNotasFixas(db: Queryable, tenantId: string, contactId: string): Promise<string> {
  const { rows } = await db.query<{ headline: string; body: string }>(
    `select headline, body from lead_notes
      where organization_id = $1 and contact_id = $2 and (headline like $3 or headline like $4)
      order by created_at, id`,
    [tenantId, contactId, `${PREFIXO_FICHA}%`, `${PREFIXO_REGISTRO}%`],
  );
  if (rows.length === 0) return '';
  const fichas = rows.filter((r) => r.headline.startsWith(PREFIXO_FICHA));
  const registros = rows.filter((r) => r.headline.startsWith(PREFIXO_REGISTRO));
  const semMarca = (b: string) => lerEstado(b).linhas.trim();

  let orcamento = TETO_NO_CONTEXTO;
  const blocos: string[] = [];
  const registroTexto = registros.map((r) => semMarca(r.body)).filter(Boolean).join('\n');
  if (registroTexto) {
    const t = registroTexto.length > 5_000 ? `…${registroTexto.slice(-5_000)}` : registroTexto;
    blocos.push(`REGISTRO DAS PERGUNTAS E RESPOSTAS (anotado pelo sistema; NÃO repita pergunta já respondida aqui):\n${t}`);
    orcamento -= t.length;
  }
  for (const f of [...fichas].reverse()) {
    if (orcamento < 800) break;
    const corpo = f.body.slice(0, orcamento);
    blocos.push(`${f.headline}\n${corpo}`);
    orcamento -= corpo.length;
  }
  return `\n\nNOTAS FIXAS DESTE ATENDIMENTO (já estão aqui: confira antes de perguntar ou de consultar de novo):\n${blocos.join('\n\n')}`;
}
