/**
 * O que o Sentry COLETA, num ponto só, para os quatro `Sentry.init` (servidor,
 * edge, cliente e worker).
 *
 * No Sentry 10 bastava `sendDefaultPii: false`: omitir era restritivo. O 11
 * removeu a opção e trocou por `dataCollection`, cujo default é o CONTRÁRIO —
 * omitir coleta IP, cookies, corpo de requisição e de resposta, entrada e saída
 * de IA, dados de query do banco e argumentos de fila (MIGRATION.md 11.0.0,
 * "`sendDefaultPii` is replaced by `dataCollection`"). Numa instalação padrão o
 * DSN é o Sentry da COMUNIDADE, então isso mandaria conversa de WhatsApp e dado
 * de paciente de terceiros da VPS do cliente para a nossa conta (issue #100).
 *
 * Por isso a coleta é declarada inteira aqui, e não deixada ao default de
 * nenhum SDK. A base é a que o guia documenta como "o comportamento do v10",
 * com um aperto: `stackFrameVariables: false` (no v10 o default era `true`; hoje
 * o `includeLocalVariables` segue desligado e nada muda, mas se alguém o ligar
 * as variáveis locais — texto de mensagem, telefone — não saem).
 *
 * O scrub (`./scrub`) continua sendo a segunda camada: o `requestData` do SDK
 * anexa o corpo que já estiver no escopo independentemente de `httpBodies`
 * (que só barra a ESCRITA), e é o `beforeSend` que o apaga.
 */
import { sentryScrubHooks } from "./scrub";

/**
 * `VercelAI` fica DESLIGADA: com o `ai` 7.0.170 ela embrulha o stream que o
 * provedor devolve e o deixa travado, e o turno do agente morre em
 * `Invalid state: The ReadableStream is locked` (medido em 18/11 com o Sentry
 * 11.10 + ai 7.0.170 + @ai-sdk/openai 4.0.115: sem a integração o mesmo
 * código responde; com ela, falha). O custo é só o span de IA no trace — o erro
 * em si, o scrub e a coleta de `genAI` (já desligada acima) não dependem dela.
 */
const INTEGRACOES_DESLIGADAS = new Set(["VercelAI"]);

// Lista do próprio guia para o "default do v10": casa por trecho do nome.
const CABECALHOS_DE_ENDERECO = ["forwarded", "-ip", "remote-", "via", "-user"];

const COLETA_RESTRITA = {
  userInfo: false,
  cookies: false,
  httpHeaders: {
    request: { deny: CABECALHOS_DE_ENDERECO },
    response: { deny: CABECALHOS_DE_ENDERECO },
  },
  httpBodies: [],
  urlQueryParams: { deny: CABECALHOS_DE_ENDERECO },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  graphQL: { document: false, variables: false },
  stackFrameVariables: false,
};

/**
 * Espalhe no `Sentry.init` de cada runtime. Coleta e scrub andam juntos de
 * propósito: um init que tenha um sem o outro é o buraco que o #1743 teria aberto.
 */
export const opcoesDePrivacidade = {
  dataCollection: COLETA_RESTRITA,
  ...sentryScrubHooks,
};

/**
 * Só para os runtimes que rodam o motor de IA (servidor, edge e worker): o
 * navegador tem a própria lista de integrações e não carrega o `ai`.
 */
export const integracoesDoServidor = {
  integrations: <T extends { name: string }>(padrao: T[]): T[] => padrao.filter((i) => !INTEGRACOES_DESLIGADAS.has(i.name)),
};
