# Plano da próxima atualização — Funil de clientes, agente de clientes e Dropbox

> **Como usar (para a próxima sessão):** leia este arquivo inteiro antes de qualquer coisa. Ele registra tudo o que foi decidido com o dono (Eduardo) até 10/11/2026.
> O que está marcado **DECIDIDO** não se rediscute. O que está **PENDENTE** precisa de resposta dele antes de construir. O que está **VERIFICAR** é suposição minha, a confirmar no código.
> Horários sempre em **horário de Brasília**. O dono valida **uma tela por vez** antes de seguir.

## 0. Frase para o dono colar numa sessão nova

```
Leia docs/sales/PLANO-PROXIMA-ATUALIZACAO.md no repositório edufoliveira01-lang/LexSync e execute a Fase <N>.
Antes de construir, me confirme os itens PENDENTE daquela fase.
```

## 1. Contexto fixo

- Produto: **DisparaZap 2 / Sales & Associados**. SaaS multi-escritório que integra o sistema **Sales** (repo `edufoliveira01-lang/-DisparadorSales2`, deploy do `main` pela Action "Atualizar Ubuntu") ao CRM com agente de IA **Deskcomm** (fork em `edufoliveira01-lang/LexSync`). Cada escritório tem o próprio número de WhatsApp; a responsabilidade do conteúdo é de cada escritório.
- Imagem do Deskcomm: `ghcr.io/edufoliveira01-lang/deskcomm-sales:1.101.0-sales.N` e `deskcomm-sales-worker`, workflow `imagem-sales.yml` (~11 min; N = número da execução; um push novo cancela o build em andamento; mudanças só em `docs/**` não disparam build).
- VPS `vps73160`, pasta `~/DeskcommCRM`. Atualização: `~/DeskcommCRM/atualizar.sh N` (confere disco >= 5 GB, baixa as duas imagens, troca `APP_IMAGE`/`WORKER_IMAGE` no `.env`, sobe `app` e `worker`; `atualizar.sh voltar` volta à versão anterior). Se faltar disco: `docker image prune -a -f` e `docker builder prune -a -f` (nunca prune de volumes).
- SQL é aplicado **pelo dono no SQL Editor do Supabase** (migrations não são aplicadas sozinhas). Prefira lógica no código do app; quando precisar de SQL, entregue o comando pronto e com salvaguardas.
- Checagens antes de cada push: `NODE_OPTIONS=--max-old-space-size=6000 npx tsc --noEmit -p .` e `npx vitest run <arquivos tocados>` (rodar em segundo plano, saída em arquivo; o Monitor espera o fim). O repositório tem testes que **leem o código-fonte** (ex.: `LeadDossier.tsx`, `KanbanCard.tsx`); mexer em estrutura exige conferir esses testes.
- Dívida conhecida: o teste `tests/unit/i18n-espanhol-cobre-a-tela.test.ts` reprova ~96 textos novos das telas de agentes sem tradução para espanhol (não afeta português).

## 2. Estado atual (builds até o 69)

Feito e no ar (conferir o número em `atualizar.sh`):

- Lígia especialista jurídica: base jurídica + calculadora de renda + atualização automática por fontes oficiais; editor de instruções em Roteiro/Regras/FAQ com menu `@` e etiquetas coloridas; máscaras de campo (CPF, CEP etc.).
- **Repaginação do CRM, uma tela por vez:**
  - Etapas do funil (cartões, faixa do funil, painel "Ajustar") — validada.
  - Campos e vocabulário em quatro partes (Nomes e motivos, Regras do funil, Atalhos do card, Campos) e "Regras do campo" em lista limpa — validada.
  - Lista de Funis em cartões, menu Ações que fecha ao clicar fora — validada.
  - Quadro com respiro no topo; **"Mostrar no card"** por campo do funil (até 3 etiquetas, só campos do Negócio) — no ar (build 68), ainda sem validação visual do dono.
  - **Painel do negócio em abas** (Resumo, Dados, Tarefas, Histórico) — build 69, **aguardando validação**.
- **Campos do contato** no painel da conversa (bloco "Campos do contato"): validado; o dono disse "há alguns ajustes, faremos depois" (**PENDENTE**: pedir a lista).
- **Excluir contato agora apaga também os negócios abertos dele** (antes o card ficava órfão e duplicava quando a pessoa voltava). Negócios ganhos/perdidos ficam como histórico. Cards órfãos antigos foram limpos por SQL.
- `atualizar.sh` criado na VPS.

Ainda sem repaginar (ordem combinada): **Início do CRM** (hub, `components/shell/NavHub.tsx` + `lib/navigation/catalogo.ts`), **Contatos, Tarefas, Planos de tarefa, Produtos, Campanhas**. O que ainda falta no card do quadro (propostas, aguardam ver o "Mostrar no card" em uso): nome em destaque com telefone embaixo; linha de "próximo passo" em destaque; tempo na etapa em cor de urgência; opção de campos do Contato aparecerem no card.

## 3. Decisões de desenho (tudo conversado com o dono)

### 3.1 Dois funis que conversam — DECIDIDO o conceito, PENDENTE parte do detalhe

- **Lígia** atende **casos novos** (funil "Atendimento jurídico"). Quem **já é cliente** é atendido por **outro agente**, num **funil de clientes** (ex.: "Clientes — acompanhamento"), marcado como "Funil de clientes" em Funis > Ações.
- O sistema já tem: automação com gatilho `lead.won` + ação `create_or_move_lead`, que **cria um card novo** no funil de destino (com os dados do original) e **deixa o ganho intacto** (`lib/automation/actions/create-or-move-lead.ts`, ramo `lead.won`, #2769). Também existem as regras "Clientes pela agenda" e "Quem já comprou volta pelo funil de clientes" (Configurações > Atendimento) e o **roteador de intenção** (`ai_routers`, membros com agente + funil/etapa de destino, #2155).
- **DECIDIDO (dono aprovou em 10/11/2026):** (a) a etapa de **ganho** do funil "Atendimento jurídico" passa de "Aguardando documentos" para **"Contrato assinado"**, e a coleta de documentos passa para o funil de clientes (muda o momento em que a venda conta nos relatórios). (b) Etapas do funil de clientes: **Aguardando documentos › Documentos recebidos › Processo em andamento › Aguardando retorno do cliente › Concluído**.
- **⚠️ NÃO trocar a etapa de ganho na tela de Etapas antes da Fase 3.** O fluxo pós-assinatura atual (Sales e Deskcomm: o sistema leva o card a "Contrato assinado" e depois à etapa de ganho "Aguardando documentos", e o agente segue pedindo documentos) depende da etapa de ganho atual. A troca precisa vir **junto** com a mudança de código desse fluxo e com a automação `lead.won`, e ser testada de ponta a ponta. **VERIFICAR** no início da Fase 3: onde o código move o card para a etapa de ganho após a assinatura (cron pós-assinatura / `crm_enviar_contrato` / ZapSign webhook) e o que o agente faz depois.
- **VERIFICAR:** o agente trabalha no **negócio aberto mais recente** da pessoa (`lib/leads/active-lead.ts`). Ao criar o card aberto no funil de clientes, a atividade do agente passa a cair nele. Conferir o impacto na coleta de documentos pós-assinatura (decisão B anterior: o agente segue pedindo documentos). Conferir se o roteador decide a cada mensagem ou só no início da conversa.

### 3.2 Segundo agente (agente de clientes) — DECIDIDO

- Criar **depois**, quando o funil de clientes existir. Regras próprias, **inclusive de como salvar documentos e em qual pasta**.
- **Passagem entre agentes pelo menu `@` do roteiro**: nova ação "Passar para o agente [nome]" (com funil/etapa de destino opcionais), cor própria. Quem recebe envia uma **mensagem inicial** (campo por agente: "ao receber uma conversa de outro agente, abrir com esta mensagem"). A passagem funciona **nos dois sentidos** (cliente → agente de clientes; CPF não encontrado → volta para a Lígia).
- Primeira pergunta ("você já é nosso cliente?"): **DECIDIDO** — a **Lígia** faz essa única pergunta no começo (para número novo) e passa a conversa ao agente de clientes.
- **Regra de entrada** (DECIDIDO):
  - Número **já ligado a um cliente** (contrato assinado): o agente de clientes cumprimenta pelo nome e começa. **Sem CPF.**
  - Número conhecido só como **lead** (nunca assinou): segue com a Lígia.
  - **Número novo**: pergunta se já é cliente; se sim, o agente de clientes **pede o CPF** (o sistema já valida o CPF) e, para sensibilidade, **data de nascimento** como segunda confirmação. CPF não encontrado: devolve à Lígia. 2–3 erros: chama a equipe.
  - Nada de dado do cliente é revelado antes da confirmação (nem que a pessoa é cliente). O agente não repete o CPF inteiro (só últimos dígitos); anotações internas gravam o CPF mascarado.
  - **Opção por agente, desligada por padrão:** confirmação extra (ex.: data de nascimento) antes de falar de valores/andamento detalhado, para número compartilhado ou chip trocado.
- **Trava no sistema, não só no roteiro:** as ferramentas de consulta do Sales (processos, andamentos, perícias, audiências, agenda, financeiro) só funcionam **depois da confirmação de identidade** (flag verificado na conversa/estado do lead).

### 3.3 Cliente muda de número — DECIDIDO como proposta, a construir

- Hoje: número novo cria contato novo e card novo (o sistema só reconhece pelo número). Existem: tela de contatos duplicados (telefone/e-mail/conflito/nome parecido), **"Juntar com outra ficha"** manual, lista **"Pessoas relacionadas"** do negócio. CPF e e-mail são únicos por contato (conflito devolve 409 `contact_exists` com o `contact_id` do dono do dado — `lib/contacts/conflito-unico.ts`).
- A construir: quando alguém de número novo informa um CPF que já existe, **ligar o número novo ao cadastro existente** (em vez de recusar ou duplicar): a conversa cai no card dele, o Dropbox segue a mesma pasta, e a equipe é avisada. Os dois números devem funcionar. Pedir CPF cedo no roteiro do agente de clientes. Só funciona depois de a pessoa informar o CPF.

### 3.4 Dropbox — DECIDIDO

**Onde mora:** no **Sales** (uma conexão por escritório, uma regra de pastas). O Deskcomm entrega o arquivo ao Sales; o Sales guarda/encaminha ao Dropbox. A pasta é vinculada ao **cadastro do cliente (CPF)**, nunca ao telefone.

**Fluxo 1 — assinados pelo ZapSign** (contrato, procuração, declarações): continuam online no Sales; ao concluir a assinatura, o Sales envia **cópia** ao Dropbox.
**Fluxo 2 — enviados pelo cliente no chat** (CNIS, CTPS, parte médica, comprovante de residência etc.): o sistema identifica o tipo e envia **direto ao Dropbox**, sem guardar cópia no Sales.

**Caminho:** `Dropbox/CLIENTES/NOME DO CLIENTE/TIPO/` (o Dropbox não diferencia maiúsculas/minúsculas). Nome do cliente em **MAIÚSCULAS e com acento**, como cadastrado.

| Pasta (TIPO) | O que entra |
|---|---|
| PARTE MÉDICA | laudos, receitas, exames, atestados |
| DOCUMENTOS PESSOAIS | RG, CPF, certidões, comprovante de residência |
| DOCUMENTOS ADMINISTRATIVO | CNIS, CTPS, indeferimento do INSS, extratos |
| CONTRATOS E PROCURAÇÕES | o que vem assinado pelo ZapSign |
| A CLASSIFICAR | o que o sistema não conseguir identificar (avisar a equipe) |

(**DECIDIDO** em 10/11/2026: o dono aprovou esta lista final de pastas. Novas pastas entram como configuração, sem mudar o código.)

**Nome do arquivo:** `AAAA-MM-DD - Tipo do documento.ext` (ordena cronologicamente no Dropbox; sem ambiguidade de dia/mês; nunca sobrescreve).

**Quando enviar:** para a Lígia, **só depois da assinatura**. Outro agente pode ter outras regras (pasta e momento por agente → ação `@` "Salvar documento na pasta [TIPO]").

**Quem cria a pasta:** o **sistema**, determinístico, **não o modelo de IA**. A IA só informa quem é o cliente e o tipo do documento. Pastas que faltam são criadas no envio (**VERIFICAR** na API do Dropbox: `files/upload` cria pastas-pai; usar `autorename` desligado e nome com data para evitar colisão).

**Pastas que já existem (com erros de grafia, ex.: "DA" x "DE"):** nunca adivinhar.
1. Nome **idêntico** (ignorando maiúsculas, acentos, espaços extras): usa a pasta existente.
2. **Parecido, mas não igual**: **não envia e não cria pasta**. O documento espera e a equipe recebe aviso "Achei pastas parecidas: … Qual é a pasta deste cliente?", escolhe com um clique.
3. A escolha grava o **vínculo no cadastro do cliente pelo identificador de pasta do Dropbox** (sobrevive a renomeação).
4. Nenhuma parecida: cria a pasta com o nome do sistema.
5. Tela única **"Vincular pastas do Dropbox"**: lista clientes do Sales x pastas de `CLIENTES`, sugere pares prováveis, o dono confirma um a um. Resolve o legado de uma vez, **sem renomear pastas existentes**.

**Só envia com o nome completo confirmado.** Documento sem nome confirmado espera.

**O que só o dono faz:** criar um **app no painel de desenvolvedores do Dropbox** e autorizar a conta do escritório. Como a pasta `CLIENTES` já existe na **raiz** do Dropbox, o app precisa de acesso **"Full Dropbox"** (o tipo "App folder" ficaria preso a `Apps/<nome>/`). ⚠️ O Dropbox **não permite restringir um app Full Dropbox a uma só pasta**: a restrição a `/CLIENTES` é **feita no código** (todo caminho é validado com o prefixo `/CLIENTES/` antes de qualquer chamada). Permissões (scopes): `files.metadata.read`, `files.metadata.write`, `files.content.read`, `files.content.write`. O token (refresh token, fluxo OAuth `token_access_type=offline`) fica guardado **criptografado** (AES-256-GCM, `ENCRYPTION_KEY`, helper `cifrar/decifrar` em `server/src/services/gestao/segredos.ts`). LGPD: documentos pessoais saem para terceiro; a conexão é feita pelo responsável do escritório.
- **VERIFICAR com o dono:** o Dropbox é pessoal/Plus ou **Business (equipe)**? Se `CLIENTES` for **pasta de equipe**, as chamadas precisam do cabeçalho `Dropbox-API-Path-Root` (e permissões de equipe). E qual é o **domínio do Sales** (a URL de retorno do OAuth tem de ser cadastrada no app).
- Multi-escritório (SaaS): cada instância do Sales é um SQLite por escritório. Para o primeiro escritório, um app do próprio dono com o retorno OAuth no domínio do Sales dele. Para vender para vários, avaliar um retorno OAuth central no painel (o painel repassa o token à instância).

**Onde plugar no código do Sales (achados de 10/11/2026):** `server/src/zapsign/contratos.ts` (tabelas `zapsign_contratos` e `zapsign_documentos` com `arquivo_id`; `estadoDoContrato` detecta a assinatura e salva o PDF assinado via `salvarArquivo` em `server/src/services/gestao/arquivos.ts`, que grava em disco `dataDir/arquivos` e em `gestao_arquivos`). A cópia para o Dropbox entra logo depois desse `salvarArquivo`, de forma assíncrona e com nova tentativa (fila simples em tabela), sem travar a assinatura. Pessoas: `gestao_pessoas` (cadastro do cliente, CPF). Novo módulo sugerido: `server/src/dropbox/` (config, OAuth, cliente HTTP, fila de envio, vínculo pessoa→pasta por `folder id`).

## 4. Ordem sugerida de execução

1. (já combinado) **Terminar a repaginação do CRM** — Início do CRM, Contatos, Tarefas, Planos de tarefa, Produtos, Campanhas — uma tela por vez, validando com o dono (Brasília).
2. **Fase 1 — Dropbox no Sales:** conexão, caminho `CLIENTES/NOME/TIPO`, cópia dos assinados do ZapSign para CONTRATOS E PROCURAÇÕES, vínculo de pasta por identificador, tela "Vincular pastas".
3. **Fase 2 — Documentos do chat:** classificação por tipo, envio ao Dropbox pelo Sales (ponte Deskcomm → Sales), "A CLASSIFICAR" + aviso à equipe, regra "só com nome confirmado/após assinatura".
4. **Fase 3 — Funil de clientes e agente de clientes:** funil + automação `lead.won` (após decidir 3.1), segundo agente com o roteiro de cliente (entrada por número conhecido / CPF + confirmação), ação `@` "Passar para o agente" + mensagem inicial, trava das ferramentas até verificar identidade, reconhecimento por CPF de número novo.
5. **Fase 4 — Regras por agente de salvar documentos** (ação `@` "Salvar documento na pasta [TIPO]").

Cada fase termina com: testes verdes, `tsc` limpo, push, build, `atualizar.sh N`, print do dono.

## 5. Perguntas em aberto para o dono

Respondidas em 10/11/2026 ("tudo aprovado"): etapa de ganho → "Contrato assinado" (3.1a), etapas do funil de clientes (3.1b), lista final de pastas (3.4), quem pergunta "já é cliente?" → Lígia (3.2).

Ainda em aberto:
- A **lista dos ajustes** do bloco **Campos do contato** do painel da conversa (o dono disse "há alguns ajustes, faremos depois" e ainda não os descreveu; "tudo aprovado" não os especificou).
- Feedback visual do **"Mostrar no card"** (quais campos usa) e do **painel do negócio em abas** (build 69).

## 6. Outros pendentes do projeto (não relacionados a esta atualização)

- Lígia: o dono aplicou o novo roteiro (11 itens) **manualmente**; só mover o texto para o gerador do Sales (`atendimentoIa.ts`) quando ele validar e pedir.
- Base jurídica: todas as fichas estão em `pendente_revisao` (revisão por advogado); confirmar salário mínimo 2026.
- Painel lateral da conversa: oferta de "Personalizar painel do contato" (seções fixas em `components/inbox/CRMSidePanel.tsx`) — o dono não respondeu o escopo.
- ZapSign: sandbox → produção; vencimento do token do GHCR (90 dias); configurações anti-banimento antes do go-live; produto "vender Sales + Deskcomm integrados" (provisionamento pelo painel, número por escritório, aviso de go-live na Central).
