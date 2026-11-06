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
