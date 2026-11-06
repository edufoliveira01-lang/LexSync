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
