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
