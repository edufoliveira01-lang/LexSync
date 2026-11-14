/**
 * Fork Sales — as AÇÕES do roteiro: um registro único (cada ação com cor, ícone, o que escolher, que ferramenta usa e como o agente a executa) e as funções
 * puras que separam o texto gravado em pedaços de texto e ações.
 *
 * No texto gravado a ação é CURTA e fácil de criar à mão: `[[Etapa: Novo contato]]`, `[[Etiqueta: NOVA DEMANDA]]`, `[[Chamar equipe]]`.
 * A tela mostra cada uma como uma etiqueta colorida (uma cor por tipo). O texto antigo, com o bloco longo "⚙ AÇÃO — …", continua sendo lido.
 */

export type TipoDeAcao =
  | "mensagem" | "chamar_equipe" | "retorno" | "avisar"
  | "anotar_sales" | "etapa" | "etiqueta_add" | "etiqueta_rem" | "responsavel" | "dados" | "salvar_documento" | "notificar" | "passar_agente"
  | "contrato"
  | "base" | "renda" | "cliente" | "andamento" | "compromissos" | "documentos" | "financeiro"
  | "horarios" | "marcar" | "remarcar" | "cancelar";

export type Escolha = "nenhuma" | "agente" | "etapa" | "etiqueta" | "pessoa" | "texto" | "tema" | "retorno";

export interface DefDaAcao {
  tipo: TipoDeAcao;
  grupo: "Conversa" | "CRM" | "Contrato" | "Consultas" | "Agenda";
  rotulo: string;
  dica: string;
  /** O começo da linha gravada: `Etapa: ` + o que a pessoa escolheu. */
  prefixo: string;
  icone: string;
  /** Classes da etiqueta (uma cor por tipo). Escritas por extenso para o Tailwind enxergá-las. */
  cor: string;
  escolhe: Escolha;
  /** As ferramentas do agente que esta ação usa: se faltar alguma ligada em "O que ele faz", a etiqueta avisa. */
  ferramentas: readonly string[];
  /** Como o agente executa (vai no texto, só das ações que o roteiro usa). */
  legenda: string;
}

export const ACOES: readonly DefDaAcao[] = [
  { tipo: "mensagem", grupo: "Conversa", rotulo: "Enviar uma mensagem pronta", dica: "Um texto exato para o cliente", prefixo: "Mensagem: ", icone: "💬", cor: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200", escolhe: "texto", ferramentas: [], legenda: "envie ao cliente exatamente esse texto." },
  { tipo: "chamar_equipe", grupo: "Conversa", rotulo: "Chamar a equipe", dica: "Passa a conversa para uma pessoa", prefixo: "Chamar equipe", icone: "🙋", cor: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200", escolhe: "nenhuma", ferramentas: ["crm_request_human_handoff"], legenda: "passe a conversa para a equipe com um resumo curto do que já foi dito (ferramenta de passagem para humano); só diga à pessoa que encaminhou depois da confirmação." },
  { tipo: "retorno", grupo: "Conversa", rotulo: "Agendar um retorno", dica: "Voltar a falar depois", prefixo: "Retorno: ", icone: "⏰", cor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200", escolhe: "retorno", ferramentas: [], legenda: "agende um retorno no prazo indicado (ferramenta de retorno) e retome o assunto com gentileza." },
  { tipo: "avisar", grupo: "Conversa", rotulo: "Avisar a equipe", dica: "Aviso interno, sem passar a conversa", prefixo: "Avisar equipe: ", icone: "🔔", cor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200", escolhe: "texto", ferramentas: ["crm_add_case_note"], legenda: "registre uma nota interna para a equipe com esse texto, sem passar a conversa (crm_add_case_note)." },
  { tipo: "anotar_sales", grupo: "CRM", rotulo: "Anotar no Sales", dica: "Anotação para a equipe no cadastro do cliente (só para quem já é cliente)", prefixo: "Anotar no Sales: ", icone: "🗒", cor: "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-100", escolhe: "texto", ferramentas: ["crm_anotar_no_sales"], legenda: "deixe no sistema Sales, para a equipe, uma anotação curta com esse assunto (crm_anotar_no_sales); só funciona para quem já é cliente e nunca leva CPF, senha ou detalhe de saúde." },
  { tipo: "etapa", grupo: "CRM", rotulo: "Mudar etapa no funil", dica: "Move o negócio de coluna", prefixo: "Etapa: ", icone: "⇄", cor: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200", escolhe: "etapa", ferramentas: ["crm_move_lead_stage"], legenda: "para os marcos do atendimento use update_lead_state (novo contato = contacted; em triagem = qualifying; proposta enviada = qualified; proposta aceita = negotiating; contrato enviado, contrato assinado e aguardando documentos o sistema move sozinho); para qualquer outra etapa use crm_move_lead_stage (descubra o funil e a etapa pelos nomes com crm_list_pipelines). Nunca marque \"ganho\"." },
  { tipo: "etiqueta_add", grupo: "CRM", rotulo: "Adicionar etiqueta", dica: "Marca o contato", prefixo: "Etiqueta: ", icone: "🏷", cor: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200", escolhe: "etiqueta", ferramentas: ["crm_manage_tags"], legenda: "adicione essa etiqueta ao contato (crm_manage_tags)." },
  { tipo: "etiqueta_rem", grupo: "CRM", rotulo: "Remover etiqueta", dica: "Tira uma marca", prefixo: "Remover etiqueta: ", icone: "🏷", cor: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200", escolhe: "etiqueta", ferramentas: ["crm_manage_tags"], legenda: "remova essa etiqueta do contato (crm_manage_tags)." },
  { tipo: "responsavel", grupo: "CRM", rotulo: "Transferir para uma pessoa", dica: "Define o responsável", prefixo: "Responsável: ", icone: "👤", cor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200", escolhe: "pessoa", ferramentas: ["crm_assign_conversation"], legenda: "atribua a conversa a essa pessoa (crm_assign_conversation; ache a pessoa com crm_list_team_members)." },
  { tipo: "dados", grupo: "CRM", rotulo: "Gravar dados do cliente", dica: "Nome, CPF, endereço…", prefixo: "Gravar dados", icone: "📝", cor: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100", escolhe: "nenhuma", ferramentas: ["crm_registrar_dados_do_cliente"], legenda: "grave no cadastro o que o cliente informou (crm_registrar_dados_do_cliente; sem campos, só consulta o que já está salvo)." },
  { tipo: "salvar_documento", grupo: "CRM", rotulo: "Salvar documento do cliente", dica: "Guarda no drive, na pasta do cliente", prefixo: "Salvar documento do cliente", icone: "🗃", cor: "bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-200", escolhe: "nenhuma", ferramentas: ["crm_salvar_documento_do_cliente"], legenda: "salve os documentos que o cliente mandou (crm_salvar_documento_do_cliente): chame sem argumentos para listar os recebidos, veja o conteúdo de cada um, escolha o tipo (parte médica, documentos pessoais, documentos administrativo ou a classificar) e um título curto, e chame de novo com referencia, tipo e titulo. O sistema cria a pasta e envia ao drive depois da assinatura; você só agradece." },
  { tipo: "passar_agente", grupo: "Conversa", rotulo: "Passar para outro agente", dica: "Outro agente continua a conversa (e o card pode mudar de funil)", prefixo: "Passar para o agente: ", icone: "🤝", cor: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200", escolhe: "agente", ferramentas: ["crm_passar_para_agente"], legenda: "passe a conversa para o agente indicado (ferramenta de passagem para outro agente). O texto vem como «Agente» ou «Agente › Funil › Etapa»: informe o nome do agente e, se houver, o funil e a etapa. Antes de acionar, avise a pessoa em uma frase curta que outro atendente vai continuar; depois da ferramenta não escreva mais nada sobre o caso: o outro agente assume na próxima mensagem. Execute uma única vez." },
  { tipo: "notificar", grupo: "Conversa", rotulo: "Notificar equipe pelo WhatsApp", dica: "Nome da notificação (Central de notificações)", prefixo: "Notificar WhatsApp: ", icone: "📲", cor: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200", escolhe: "texto", ferramentas: ["crm_notificar_equipe"], legenda: "avise a equipe por WhatsApp (crm_notificar_equipe) usando a notificação com esse nome, com 1 ou 2 frases de resumo do caso; faça isto uma única vez por atendimento." },
  { tipo: "contrato", grupo: "Contrato", rotulo: "Enviar o contrato", dica: "Link de assinatura", prefixo: "Enviar contrato", icone: "📄", cor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200", escolhe: "nenhuma", ferramentas: ["crm_enviar_contrato"], legenda: "envie o contrato para assinatura (crm_enviar_contrato), uma única vez e somente depois da confirmação dos dados pelo cliente." },
  { tipo: "base", grupo: "Consultas", rotulo: "Consultar a base jurídica", dica: "Responder com a ficha do tema", prefixo: "Base jurídica: ", icone: "⚖", cor: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200", escolhe: "tema", ferramentas: ["crm_consultar_base_juridica"], legenda: "consulte a ficha do tema (crm_consultar_base_juridica) e responda com base nela." },
  { tipo: "renda", grupo: "Consultas", rotulo: "Calcular a renda por pessoa", dica: "BPC: 1/4 e 1/2 do salário mínimo", prefixo: "Calcular renda", icone: "🧮", cor: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200", escolhe: "nenhuma", ferramentas: ["crm_calcular_renda_per_capita"], legenda: "calcule a renda por pessoa da família com crm_calcular_renda_per_capita; nunca calcule de cabeça nem cite o salário mínimo de memória." },
  { tipo: "cliente", grupo: "Consultas", rotulo: "Consultar o cliente", dica: "Cadastro, processos e contrato", prefixo: "Consultar cliente", icone: "🔎", cor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200", escolhe: "nenhuma", ferramentas: [], legenda: "use consultar_cliente (acha o cadastro pelo telefone da conversa)." },
  { tipo: "andamento", grupo: "Consultas", rotulo: "Andamento do processo", dica: "Fase, publicações e prazos", prefixo: "Andamento do processo", icone: "📑", cor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200", escolhe: "nenhuma", ferramentas: [], legenda: "use andamento_do_processo e responda só com o que a ferramenta devolveu." },
  { tipo: "compromissos", grupo: "Consultas", rotulo: "Próximos compromissos", dica: "Perícias e audiências", prefixo: "Próximos compromissos", icone: "📆", cor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200", escolhe: "nenhuma", ferramentas: [], legenda: "use proximos_compromissos e confirme dia, horário e local que a ferramenta trouxe." },
  { tipo: "documentos", grupo: "Consultas", rotulo: "Documentos do cliente", dica: "O que chegou e o que falta", prefixo: "Documentos do cliente", icone: "🗂", cor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200", escolhe: "nenhuma", ferramentas: [], legenda: "use documentos_do_cliente." },
  { tipo: "financeiro", grupo: "Consultas", rotulo: "Financeiro do cliente", dica: "Parcelas e pagamentos", prefixo: "Financeiro do cliente", icone: "💰", cor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200", escolhe: "nenhuma", ferramentas: [], legenda: "use financeiro_do_cliente somente se o cliente perguntar; não negocie valores." },
  { tipo: "horarios", grupo: "Agenda", rotulo: "Ver horários livres", dica: "Consulta a agenda", prefixo: "Horários livres", icone: "🕒", cor: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200", escolhe: "nenhuma", ferramentas: ["crm_find_free_slots"], legenda: "consulte os horários livres (crm_find_free_slots)." },
  { tipo: "marcar", grupo: "Agenda", rotulo: "Marcar um compromisso", dica: "Agenda para o cliente", prefixo: "Marcar compromisso", icone: "📌", cor: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200", escolhe: "nenhuma", ferramentas: ["crm_book_appointment"], legenda: "marque o compromisso (crm_book_appointment) no horário que o cliente escolheu." },
  { tipo: "remarcar", grupo: "Agenda", rotulo: "Remarcar um compromisso", dica: "Troca o horário", prefixo: "Remarcar compromisso", icone: "🔁", cor: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200", escolhe: "nenhuma", ferramentas: ["crm_reschedule_appointment"], legenda: "remarque o compromisso (crm_reschedule_appointment)." },
  { tipo: "cancelar", grupo: "Agenda", rotulo: "Cancelar um compromisso", dica: "Libera o horário", prefixo: "Cancelar compromisso", icone: "🚫", cor: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200", escolhe: "nenhuma", ferramentas: ["crm_cancel_appointment"], legenda: "cancele o compromisso (crm_cancel_appointment)." },
];

export const GRUPOS: readonly DefDaAcao["grupo"][] = ["Conversa", "CRM", "Contrato", "Consultas", "Agenda"];
export const defDaAcao = (tipo: TipoDeAcao): DefDaAcao => ACOES.find((a) => a.tipo === tipo)!;

/** A linha gravada de uma ação, com o que a pessoa escolheu. */
export const linhaDaAcao = (tipo: TipoDeAcao, valor = ""): string => {
  const d = defDaAcao(tipo);
  const v = valor.replace(/\s+/g, " ").replace(/\]\]/g, "] ]").trim();
  if (tipo === "mensagem") return `${d.prefixo}“${v.replace(/^[“"]|[”"]$/g, "")}”`;
  return `${d.prefixo}${v}`.trimEnd();
};

/** Os dois formatos antigos (o bloco longo) para a ação nova. */
const LEGADO: readonly [string, TipoDeAcao][] = [
  ["Remover etiqueta:", "etiqueta_rem"], ["Etiqueta:", "etiqueta_add"], ["Notificar equipe:", "avisar"], ["Envie ao cliente, exatamente assim:", "mensagem"],
  ["Passe a conversa para a equipe", "chamar_equipe"], ["Agende um retorno", "retorno"], ["Grave no cadastro", "dados"], ["Envie o contrato para assinatura", "contrato"], ["Consulte a base jurídica sobre", "base"],
];

export interface RotuloDaAcao { icone: string; texto: string; tipo: TipoDeAcao | "outra"; cor: string }
const COR_PADRAO = "bg-muted text-foreground";

/** Como a ação aparece na tela: ícone, texto curto e cor, pelo que a linha diz. */
export function rotuloDaAcao(linha: string): RotuloDaAcao {
  const l = linha.trim();
  // mais longo primeiro, para "Remover etiqueta: " não cair em "Etiqueta: "
  const porPrefixo = [...ACOES].sort((a, b) => b.prefixo.length - a.prefixo.length).find((a) => l === a.prefixo.trim() || l.startsWith(a.prefixo));
  if (porPrefixo) {
    const resto = l.slice(porPrefixo.prefixo.trim().length).replace(/^:\s*/, "").trim();
    const rotulo = porPrefixo.prefixo.replace(/:\s*$/, "").trim();
    const texto = porPrefixo.escolhe === "nenhuma" ? rotulo : porPrefixo.tipo === "mensagem" ? `${rotulo}: ${resto.replace(/^[“"]|[”"]$/g, "")}` : `${rotulo}: ${resto}`;
    return { icone: porPrefixo.icone, texto, tipo: porPrefixo.tipo, cor: porPrefixo.cor };
  }
  const leg = LEGADO.find(([p]) => l.startsWith(p));
  if (leg) {
    const d = defDaAcao(leg[1]);
    const resto = l.slice(leg[0].length).replace(/^[\s:]+/, "").replace(/\s+e (responda|retome).*$/, "").replace(/^[“"]|[”"]$/g, "");
    return { icone: d.icone, texto: d.escolhe === "nenhuma" ? d.prefixo.trim() : `${d.prefixo.replace(/:\s*$/, "")}${resto ? `: ${resto}` : ""}`, tipo: d.tipo, cor: d.cor };
  }
  return { icone: "⚙", texto: l, tipo: "outra", cor: COR_PADRAO };
}

/** O tipo da ação que a linha representa, ou null. */
export const tipoDaLinha = (linha: string): TipoDeAcao | null => { const r = rotuloDaAcao(linha); return r.tipo === "outra" ? null : r.tipo; };

// ───────────────────────── texto gravado ⇄ pedaços ─────────────────────────

export const CABECALHO_LEGADO = "⚙ AÇÃO — execute uma única vez; nunca mostre isto ao cliente:";
export type Segmento = { t: "texto"; v: string } | { t: "acao"; linha: string };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RX = () => new RegExp(`\\n?${esc(CABECALHO_LEGADO)}\\n([^\\n]*)\\n?|\\[\\[([^\\]\\n]{1,400})\\]\\]`, "g");

/** O texto gravado em pedaços de texto e ações (lê o formato curto `[[…]]` e o bloco longo antigo). */
export function paraSegmentos(texto: string): Segmento[] {
  const out: Segmento[] = [];
  const rx = RX();
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(texto)) !== null) {
    if (m.index > ultimo) out.push({ t: "texto", v: texto.slice(ultimo, m.index) });
    out.push({ t: "acao", linha: (m[1] ?? m[2] ?? "").trim() });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) out.push({ t: "texto", v: texto.slice(ultimo) });
  return out;
}

/** Os pedaços de volta no texto gravado (sempre no formato curto). */
export function deSegmentos(segs: readonly Segmento[]): string {
  return segs.map((g) => (g.t === "texto" ? g.v : `[[${g.linha}]]`)).join("");
}

/** Os tipos de ação que o texto usa, sem repetir, na ordem do registro. */
export function tiposUsados(texto: string): TipoDeAcao[] {
  const usados = new Set<TipoDeAcao>();
  for (const g of paraSegmentos(texto)) if (g.t === "acao") { const t = tipoDaLinha(g.linha); if (t) usados.add(t); }
  return ACOES.map((a) => a.tipo).filter((t) => usados.has(t));
}

/** O parágrafo que ensina o agente a executar as ações que o roteiro usa (só as usadas). Vazio se o texto não tem ação. */
export function legendaDasAcoes(texto: string): string {
  const tipos = tiposUsados(texto);
  if (tipos.length === 0) return "";
  const linhas = tipos.map((t) => { const d = defDaAcao(t); return `- **${d.prefixo.replace(/:\s*$/, "").trim()}**: ${d.legenda}`; });
  return `Os trechos entre [[ e ]] no roteiro são ações internas: execute cada uma uma única vez, no momento em que o roteiro a indica (confira no histórico se já foi feita), e **nunca os mostre ao cliente**. Como cada uma se faz:\n${linhas.join("\n")}`;
}
