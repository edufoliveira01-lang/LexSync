/**
 * VOCABULÁRIO DE ESCRITÓRIO DE ADVOCACIA — o produto nasceu para loja e comércio ("venda", "loja", "produto", "comanda"), e este
 * fork é de um escritório. Aqui a troca é feita NA EXIBIÇÃO, em português, sem tocar nas chaves do dicionário (as traduções para
 * outros idiomas continuam achando a chave original) e sem editar as milhares de telas.
 *
 * Duas camadas, nesta ordem:
 *  1. FRASES exatas (as do menu, dos hubs e das telas principais): o texto inteiro vira outro, com a concordância certa.
 *  2. PALAVRAS seguras (com o artigo junto, por causa do gênero: "a loja" → "o escritório").
 *
 * Fora dos testes (a suíte confere os textos originais). O resultado é guardado: `traduzir` roda a cada render.
 */

const FRASES: Record<string, string> = {
  // menu e hubs
  "Prospecção": "Captação ativa",
  "Busque empresas e conduza abordagens graduais com IA.": "Busque pessoas e empresas e conduza abordagens graduais com IA.",
  "Campanhas": "Mensagens em massa",
  "Fale com uma lista de contatos que você escolhe, no ritmo do número.": "Envie uma mensagem a uma lista de contatos que você escolhe, no ritmo do número.",
  "Cold Call": "Ligações ativas",
  "Ligue para uma lista de leads, um por vez, com roteiro e resultado de cada ligação.": "Ligue para uma lista de contatos, um por vez, com roteiro e resultado de cada ligação.",
  "Produtos": "Serviços",
  "O catálogo da loja, com o preço que o atendente de IA responde.": "Os serviços do escritório e os honorários que o atendente de IA informa.",
  "Comandas": "Lançamentos",
  "O que foi feito, por quem, e quanto o cliente paga.": "O que foi feito, por quem, e quanto o cliente paga em honorários.",
  "Propostas": "Propostas de honorários",
  "Rascunhe, revise e envie propostas comerciais — do orçamento ao aceite.": "Rascunhe, revise e envie propostas de honorários — da análise do caso ao aceite.",
  "Modelos de proposta": "Modelos de proposta de honorários",
  "Seus funis de venda — clique em um para abrir o quadro de clientes.": "Seus funis de captação — clique em um para abrir o quadro de casos.",
  "Sequências reutilizáveis de tarefas — montar uma vez e aplicar a cada negócio.": "Sequências reutilizáveis de tarefas — montar uma vez e aplicar a cada caso.",
  "As colunas de cada funil, o vocabulário do negócio e os motivos de perda.": "As colunas de cada funil, o vocabulário do caso e os motivos de perda.",
  "Meta de vendas": "Meta de contratações",
  "Quanto a empresa quer vender no mês, para o Desempenho medir o progresso.": "Quantos casos o escritório quer fechar no mês, para o Desempenho medir o progresso.",
  "Conversões": "Contratações dos anúncios",
  "Devolver ao anúncio as vendas que ele trouxe, e marcar a origem de quem chega pelo site.": "Devolver ao anúncio as contratações que ele trouxe, e marcar a origem de quem chega pelo site.",
  "Conecte a loja para trazer pedidos e clientes para dentro do CRM.": "Conecte uma loja virtual para trazer pedidos e clientes para dentro do CRM.",
  "O dia a dia da venda": "O dia a dia da captação",
  "Preparar a venda": "Preparar a captação",
  "Onde a venda acontece — e o que você define uma vez para ela funcionar.": "Onde a captação de clientes acontece — e o que você define uma vez para ela funcionar.",
  "Como o negócio foi no período — e o histórico para quando alguém perguntar por quê.": "Como o escritório foi no período — e o histórico para quando alguém perguntar por quê.",
  "Os materiais que o agente consulta antes de responder sobre o seu negócio.": "Os materiais que o agente consulta antes de responder sobre o seu escritório.",
  "Atendimento e vendas pelo WhatsApp, com agentes de inteligência artificial.": "Atendimento e captação de clientes pelo WhatsApp, com agentes de inteligência artificial.",
  "Atendimento e vendas pelo WhatsApp, também no celular.": "Atendimento e captação de clientes pelo WhatsApp, também no celular.",
  "Casos": "Atendimentos da IA",
  "Os atendimentos que o agente conduziu, do início ao desfecho.": "As conversas que o agente conduziu, do início ao desfecho.",
  // venda → contratação
  "Venda (negócio ganho)": "Contratação (caso ganho)",
  "Valor do negócio": "Valor dos honorários",
  "Nome do negócio": "Nome do caso",
  "Novo negócio": "Novo caso",
  "Buscar por negócio": "Buscar por caso",
  "Resumo do negócio": "Resumo do caso",
  "Compra": "Contratação",
  "Meus negócios": "Meus casos",
  "Empresas e pessoas (venda para empresas)": "Empresas e pessoas (clientes pessoa jurídica)",
};

/** Palavras, com o artigo/preposição junto quando o gênero muda. A ordem importa: a mais específica primeiro. */
const PALAVRAS: Array<[RegExp, string | ((m: string, ...g: string[]) => string)]> = [
  [/\bseu negócio\b/gi, (m) => (m[0] === "S" ? "Seu escritório" : "seu escritório")],
  [/\bfunis? de vendas?\b/gi, (m) => (/funis/i.test(m) ? "funis de captação" : "funil de captação")],
  [/\bpropostas comerciais\b/gi, "propostas de honorários"],
  [/\bproposta comercial\b/gi, "proposta de honorários"],
  // loja → escritório
  [/\b(da|na|pela) loja\b/gi, (_m, a: string) => ({ da: "do", na: "no", pela: "pelo" } as Record<string, string>)[a.toLowerCase()] + " escritório"],
  [/\b(a|A) loja\b/g, (_m, a: string) => (a === "A" ? "O escritório" : "o escritório")],
  [/\bloja\b/gi, "escritório"],
  // vendedor → responsável
  [/\bvendedores\b/gi, "responsáveis"],
  [/\bvendedor(a)?\b/gi, "responsável"],
  // venda → contratação
  [/\bvendas\b/gi, (m) => (m[0] === "V" ? "Contratações" : "contratações")],
  [/\bvenda\b/gi, (m) => (m[0] === "V" ? "Contratação" : "contratação")],
  // negócio → caso
  [/\bnegócios\b/gi, (m) => (m[0] === "N" ? "Casos" : "casos")],
  [/\bnegócio\b/gi, (m) => (m[0] === "N" ? "Caso" : "caso")],
  // produto → serviço
  [/\bprodutos\b/gi, (m) => (m[0] === "P" ? "Serviços" : "serviços")],
  [/\bproduto\b/gi, (m) => (m[0] === "P" ? "Serviço" : "serviço")],
  // comanda → lançamento (feminino → masculino)
  [/\buma comanda\b/gi, "um lançamento"],
  [/\b(a|A) comanda\b/g, (_m, a: string) => (a === "A" ? "O lançamento" : "o lançamento")],
  [/\bda comanda\b/gi, "do lançamento"],
  [/\bna comanda\b/gi, "no lançamento"],
  [/\bcomandas\b/gi, "lançamentos"],
  [/\bcomanda\b/gi, "lançamento"],
  // jargão técnico → português do escritório
  [/\btenant\b/gi, "escritório"],
  [/\broles\b/gi, "papéis"],
  // leads → contatos; card → cartão; custom fields → campos personalizados
  [/\bleads\b/gi, "contatos"],
  [/\blead\b/gi, "contato"],
  [/\bcustom fields\b/gi, "campos personalizados"],
  [/\bcards\b/gi, "cartões"],
  [/\bcard\b/gi, "cartão"],
];

const memo = new Map<string, string>();

/** O texto em português com o vocabulário de escritório. Texto sem nenhuma dessas palavras volta idêntico. */
export function vocabularioJuridico(texto: string): string {
  const guardado = memo.get(texto);
  if (guardado !== undefined) return guardado;
  let saida = FRASES[texto];
  if (saida === undefined) {
    saida = texto;
    for (const [re, troca] of PALAVRAS) saida = saida.replace(re, troca as never);
  }
  if (memo.size > 20000) memo.clear();
  memo.set(texto, saida);
  return saida;
}

/** Fora da suíte de testes (que confere os textos originais). */
export const VOCABULARIO_LIGADO = !(typeof process !== "undefined" && process.env?.VITEST);
