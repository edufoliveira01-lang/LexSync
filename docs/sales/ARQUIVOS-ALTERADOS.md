# Arquivos do DeskcommCRM que o fork altera

Regra: o visual vive em `app/tema-sales.css`. Estes são os únicos arquivos do original que mexemos (para o script de atualização,
`scripts/sales/sincronizar-upstream.sh`, saber onde pode haver conflito). Marcamos cada trecho nosso com "Fork Sales".

| Arquivo | O que mudou |
|---|---|
| `app/layout.tsx` | importa `./tema-sales.css` (uma linha) |
| `components/inbox/ConversationHeader.tsx` | cabeçalho enxuto: nome clicável (abre a ficha), linha de apoio (dono, telefone, selo) e ações secundárias no menu "Mais ações" |
| `components/inbox/InboxLayout.tsx` | título "Conversas" + botão compacto; ficha do contato só com conversa aberta; `data-sem-conversa`; liga o nome do cabeçalho à ficha |
| `components/inbox/InboxFilters.tsx` | busca em linha própria; filtros auxiliares recolhidos atrás de um botão de funil |
| `components/inbox/PainelIniciarConversa.tsx` | `BotaoIniciarConversa` ganha o modo `compacto` (ícone) |
| `lib/i18n/dicionario.ts` | 2 textos novos em espanhol |
| `components/inbox/ConversationHeader.acoes.test.tsx`, `tests/unit/inbox-header-nao-trava.test.tsx`, `tests/unit/inbox-divisorias-arrastaveis.test.tsx` | testes ajustados ao novo contrato (o original recusava o menu "Mais ações" e exigia a ficha sempre presente) |

Ao sincronizar com o original, se esses arquivos conflitarem: mantenha a versão do original e reaplique as mudanças marcadas "Fork Sales".

## Registro de assumir/transferir/liberar/fechar na conversa (sales.6)

- `lib/inbox/evento-na-conversa.ts` (novo): grava uma nota interna com marca invisível.
- `components/inbox/EventoDaConversa.tsx` (novo) e 1 ramo em `components/inbox/ChatThread.tsx`: desenha a linha centralizada.
- Chamadas em `lib/inbox/assumir-conversa*.ts`, rotas `release`, `transfer`, `close` e `_handler.ts` (reabrir/arquivar).

## Correções da sales.10

- `components/inbox/InboxLayout.tsx`: atributo `data-painel-recolhido` na grade; aba IA vazia quando a organização não tem agente no ar (`tabToFilter`).
- `app/api/v1/conversations/counts/route.ts`: contador da aba IA = 0 sem agente no ar.
- `app/tema-sales.css`: colunas fixas 344/320, trilho de 44px quando o painel está recolhido, divisórias arrastáveis ocultas.

## Refinos (sales.12)

- `components/shell/SearchTrigger.tsx`, `Sidebar.tsx`, `TopBar.tsx`: busca (⌘K) no topo do menu lateral.
- `components/inbox/ConversationHeader.tsx` (+ `GerarContrato.tsx` novo): botão "Gerar contrato" (Assumir foi para "Mais ações"), botão copiar, linha do cabeçalho clicável para abrir a ficha.
- `components/inbox/ConversationListItem.tsx`, `ConversationList.tsx`, `BarraDeAcoesEmLote.tsx`: seleção em lote sobre o avatar, barra em lote em duas linhas.
- `components/inbox/InboxLayout.tsx` + `app/app/inbox/page.tsx`: ficha do contato nasce fechada e sem trilho.

## Barra de cima no menu lateral (sales.13)

- `components/shell/TopBar.tsx` (`md:hidden`), `Sidebar.tsx`, `UserMenu.tsx`: notificações, tema e perfil no rodapé do menu; idioma só em Configurações → Perfil.
- `components/inbox/InboxLayout.tsx` + `counts/route.ts`: aba "Todas" só com abertas/ativas.

## Painel de detalhes do contato (sales.15)

- `components/inbox/CRMSidePanel.tsx`: título "Detalhes do contato" na faixa do alto e avatar grande no cartão do contato (o resto do visual é CSS em `app/tema-sales.css`, seção 14).
- Cabeçalho da conversa: a identidade encolhe (reticências) em vez de empurrar os botões para uma segunda linha.

## Funil para advocacia (um clique)
- `lib/pipelines/modelo-advocacia.ts` (novo) + `modelo-advocacia.test.ts`: as 7 etapas (Novo contato → … → Contrato assinado / Sem interesse) já com `agent_stage_hint`, para o agente mover o card sozinho.
- `app/api/v1/pipelines/route.ts`: `POST` aceita `modelo: "advocacia"` (mudança mínima: o corpo e a compensação são os de sempre).
- `hooks/pipelines/usePipelines.ts` (`useCriarFunil` aceita `{ name, modelo }`) e `app/app/kanban/_client.tsx` (botão "Funil para advocacia" ao lado de "Novo funil").

## Agente do escritório (prompt gerado pelo Sales)
- `lib/sales/contratos.ts`: `chamar` aceita o recurso (`contratos` | `agente`) e ganha `promptDoAgenteDoEscritorio` (GET `/agente/prompt` pelo painel, assinado como o contrato).
- `app/api/v1/sales/agente-do-escritorio/route.ts` (novo): GET (agentes + pendências do cadastro) e POST `{ agent_id }` → grava uma NOVA VERSÃO RASCUNHO do agente (copia o resto com `versionPayloadFrom`, troca só o `system_prompt`). Nunca publica.
- `components/ai/AtualizarAgenteDoEscritorio.tsx` (novo) + `app/app/ai/agents/_components/AgentsList.tsx` (botão ao lado de "Criar novo").
- Cadastro: no Sales, Configurações › Atendimento com IA (`gestao_atendimento_ia`). Modelo: `docs/sales/agente-juridico.md`.
- `app/app/ai/agents/[id]/_components/UsarTextoDoEscritorio.tsx` (novo) + `AgentForm.tsx` (uma linha de import e um componente no cabeçalho de "As instruções dele"): botão "Usar o texto do escritório" preenche o campo com o prompt do Sales — funciona na criação do agente (empresa sem agente nenhum) e na edição. O `GET` da rota passou a devolver também o `prompt`.
- `lib/sales/modelo-agente-juridico.ts` (+ teste, novo): o que "Usar o texto do escritório" configura além do prompt — nome, descrição, 17 ferramentas (funil, cadastro, agenda, passagem para humano, nota), palavras de passagem, `handoff_legal_enabled` DESLIGADO (num escritório "questão jurídica" é o assunto), mensagens curtas, visão de imagem, janela de histórico e o funil «Atendimento jurídico» (sem tirar os já marcados). Não mexe em provedor, modelo, credencial nem canal. `AgentForm.tsx` só passa o resultado para `patch`.

## Agente consulta o cadastro do cliente (MCP do Sales) e prepara o contrato
- `lib/sales/mcp.ts` (novo): endereço (`<SALES_PAINEL_URL>/mcp/<slug>`) e chave (HMAC de `CONTRATOS_SEGREDO` + slug — a mesma conta do Sales) do servidor de ferramentas de cada escritório; lista das 5 consultas (somente leitura).
- `app/api/v1/sales/agente-do-escritorio/ligar-consultas/route.ts` (novo, admin): registra esse servidor em `organizations.settings.mcp_externo` + chave cifrada (mesmas funções do cadastro manual, mesmo guard anti-SSRF). Idempotente.
- `UsarTextoDoEscritorio.tsx`: antes de buscar o texto, liga as consultas e (agente existente) o interruptor `mcp_externo_no_atendimento`. `AgentForm.tsx`: ao CRIAR o agente com consultas do Sales escolhidas, liga o interruptor (PATCH logo após a criação).
- `lib/sales/modelo-agente-juridico.ts`: as 5 consultas entram em `tool_ids` como `mcp_externo:leitura:<nome>`.
- `lib/pipelines/modelo-advocacia.ts` + `app/api/v1/pipelines/route.ts`: o funil «Atendimento jurídico» nasce com os campos do contrato (CPF, RG, nacionalidade, estado civil, profissão, endereço) — o agente os preenche e o formulário "Gerar contrato" abre com eles.
- Contrato pelo agente: o agente PREPARA (campos do negócio + nota + passagem à equipe); quem envia é a pessoa. O Deskcomm recusa ferramentas de ESCRITA durante o atendimento de propósito, e a criação do contrato no ZapSign é escrita.

## O agente envia o contrato e a assinatura é acompanhada pelo servidor
- `lib/mcp/tools/contratos-sales.ts` + `lib/mcp/tools/catalogo/contratos-sales.ts` (novos), `lib/mcp/tools/index.ts` (import e uma linha), `lib/mcp/tools/catalogo/index.ts` (import e uma linha): ferramenta nativa `crm_enviar_contrato` (escrita, papel `ai_operator`: só o agente a usa; pessoas usam o botão). Alvo SEMPRE o contato do turno; exige `confirmou_com_o_cliente: true`; não gera segundo contrato enquanto houver um aguardando assinatura; devolve `mensagem_para_enviar` com o link.
- `lib/ai/runtime/escopo-das-escritas.ts`: `crm_enviar_contrato: {}` (sem id de cliente nos argumentos). `tests/unit/peso-das-ferramentas.test.ts`: teto da ferramenta (+790) e `TETO_TOTAL`.
- `lib/sales/contrato-na-conversa.ts` (novo): o que morava na rota (`slugDaOrg`, `padraoDaOrg`, `sincronizarContato`, `aplicar`) + `criarContratoNaConversa` (rota e agente usam a MESMA implementação) + `contratoPendenteDaConversa`. `lib/sales/mensagem-do-contrato.ts` (novo, extraído do formulário).
- `lib/sales/acompanhar-contratos.ts` (novo): o acompanhamento da assinatura NO SERVIDOR — move o negócio (ou cria, pela mesma regra do botão), etiqueta, fecha a conversa, grava "Contrato assinado" ANTES de avisar o cliente e envia a mensagem de agradecimento. A rota GET usa a mesma função (o navegador só dispara a conferência). Rodada de 60 s ligada em `instrumentation.ts` (um bloco de 2 linhas, só no runtime nodejs; sem `SALES_PAINEL_URL`/`CONTRATOS_SEGREDO` não liga). Trava em memória: uma instância do app por instalação.
- `app/api/v1/conversations/[id]/contrato/route.ts`: POST/GET enxutos (usam as funções acima).

- `lib/leads/escopo-de-funil.ts`: `crm_enviar_contrato` classificada como `sem_funil` (sem isso o motor recusava a ferramenta em silêncio, pela regra de vacuidade).
- `lib/sales/modelo-agente-juridico.ts`: janela de histórico do agente jurídico de 30 para 60 mensagens (menos perguntas repetidas em conversa longa).
- `lib/sales/etapa-do-contrato.ts` (novo): o funil anda sozinho com o contrato. Ao enviar, o negócio aberto do contato vai para "Contrato enviado"; ao assinar (sem destino escolhido em "depois da assinatura"), vai para a etapa de ganho. Usa `moveLeadHandler`, com todas as regras do funil. Ligado em `contrato-na-conversa.ts` e `acompanhar-contratos.ts`.
- `lib/mcp/tools/contratos-sales.ts`: a ferramenta ENVIA o link ao cliente (via `enviarTexto`, exportado de `acompanhar-contratos.ts`), sem depender de o modelo chamar send_message. Só se o envio falhar devolve `mensagem_para_enviar`.
- `lib/pipelines/modelo-advocacia.ts`: funil NOVO (Novo contato, Em triagem, Proposta enviada, Proposta aceita, Contrato enviado, Contrato assinado, Aguardando documentos [ganho], Sem interesse). Passos do agente: new, qualifying, qualified, negotiating; contrato enviado/assinado sem passo (o sistema move).
- `lib/sales/modelo-agente-juridico.ts`: `funilJuridicoMaisRecente` (funil recriado nasce com slug -2, -3…).
- `lib/sales/dados-do-cliente.ts` (novo) e ferramenta `crm_registrar_dados_do_cliente` (`lib/mcp/tools/contratos-sales.ts`): o agente grava cada dado do cliente na hora (contato + negócio) e o contrato (`crm_enviar_contrato`) sai do que já está gravado; nome completo só é exigido na hora do contrato. Catálogo, escopo de funil, escopo das escritas, peso e modelo do agente atualizados.
- `lib/sales/pos-assinatura.ts` (novo): depois da assinatura o agente é acordado por um retorno agendado (pede os documentos) e, passados 3 min, o sistema leva o negócio de "Contrato assinado" à etapa de ganho. Etiqueta padrão "Contrato assinado". Mensagem fixa pós-assinatura encurtada.
- `lib/sales/acompanhar-contratos.ts`: ao assinar, o funil do PRÓPRIO cliente tem prioridade: um destino configurado em "depois da assinatura" só vale se o cliente tem negócio aberto naquele funil; senão o negócio dele vai para "Contrato assinado" (antes criava um negócio novo em outro funil).
- `lib/pipelines/modelo-advocacia.ts`: "Aguardando documentos" (etapa de ganho) SEM passo do agente: o agente não fecha mais o negócio antes da assinatura (o passo interno "ganho" movia o card para lá ao aceitar o contrato). Quem leva o card é o sistema, depois da assinatura. Funis já criados: `update crm_stages set agent_stage_hint = null where name = $$Aguardando documentos$$`.
- `lib/inbox/acao-do-agente.ts` (novo): anotações internas do chat (só a equipe vê): "Agente de IA: gravou no cadastro: CPF, RG", "moveu o negócio para «X»", "agendou um retorno…", "Sistema: moveu o negócio para «X»". Ligado em `lib/ai/runtime/tools.ts` (escritas do agente), `lib/agent-engine/edge/crm/move-lead-stage.ts` (espelho do funil), `lib/agent-engine/agent/schedule-followup.ts` (retorno), `lib/sales/etapa-do-contrato.ts` e `lib/sales/pos-assinatura.ts` (sistema). Só nomes de campos, nunca os valores.
