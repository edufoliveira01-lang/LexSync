import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ConversationHeader } from "@/components/inbox/ConversationHeader";

/**
 * CATRACA: o header do inbox não pode voltar a travar a largura da tela.
 *
 * ## O defeito, medido
 *
 * A barra de ações deste header era `shrink-0`. Como ela não encolhia nem
 * quebrava, o `min-content` do header inteiro era **707px** — e a coluna do
 * meio do inbox é `1fr`, que é `minmax(auto, 1fr)` e não encolhe abaixo do
 * conteúdo. Resultado: o painel de CRM ficava **311px fora da viewport em
 * 1280px**. Em uma resolução de trabalho comum, o atendente não via contexto
 * nenhum do cliente.
 *
 * ## Por que este teste é o que é (e o que ele NÃO é)
 *
 * Este teste olha CLASSE, não pixel — e isso é uma limitação declarada, não um
 * descuido: `min-content`, quebra de flex e resolução de grid são cálculo de
 * layout, e o jsdom não tem engine de layout. Medir largura aqui devolveria
 * zero em tudo e passaria feliz: verde por ausência de motor.
 *
 * A medição de verdade é `tests/sonda-inbox-cabe-na-tela.ts`, que roda num
 * browser e afere as 5 larguras. Esta catraca existe porque aquela sonda não
 * roda no CI, e a regressão específica — alguém devolver `shrink-0` à barra de
 * ações "para os botões não quebrarem" — é textual e barata de pegar.
 *
 * Se um dia o CI ganhar um passo de browser, este arquivo pode morrer em favor
 * da sonda. Enquanto isso, ele é a única coisa entre a regressão e a main.
 */

vi.mock("@/hooks/inbox/useClaimConversation", () => ({
  useClaimConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/inbox/useCloseConversation", () => ({
  useCloseConversation: () => ({ mutate: vi.fn(), isPending: false }),
  useReopenConversation: () => ({ mutate: vi.fn(), isPending: false }),
  // O header passou a importar `useArchiveConversation` do MESMO módulo (issue
  // #923). Um dublê fechado que não acompanha a nova exportação não falha com
  // "faltou mock": falha com "useArchiveConversation is not a function", que
  // não fala nada do que este arquivo vigia.
  useArchiveConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/inbox/useReleaseConversation", () => ({
  useReleaseConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));
// O nome do módulo importa: a primeira versão deste arquivo mockava
// "useResumeAi", que NÃO EXISTE — o real é `useResumeAiAttendance`. O teste
// passou assim mesmo (o hook verdadeiro rodou sob o provider), ou seja, o mock
// não mockava nada e ninguém era avisado. Mock de caminho inexistente é ruído
// que parece cobertura.
vi.mock("@/hooks/inbox/useResumeAiAttendance", () => ({
  useResumeAiAttendance: () => ({ mutate: vi.fn(), isPending: false }),
}));
// O header monta o discador (`DialButton`), que exige o `VoiceCallProvider` do
// shell autenticado. Aqui só a largura importa: o discador fica fora da conta.
vi.mock("@/components/voice/DialButton", () => ({ DialButton: () => null }));
vi.mock("@/hooks/auth/AuthProvider", () => ({
  usePermission: () => true,
  useAuth: () => ({ user: { id: "u-1" }, activeOrg: { orgId: "org-1", role: "manager" } }),
}));

const conversation = {
  id: "cv-1",
  organization_id: "org-1",
  contact_id: "ct-1",
  status: "open",
  assigned_to_user_id: null,
  assignee_kind: "ai",
  snooze_until: null,
  tags: [],
  contacts: { id: "ct-1", display_name: "Fulana", name: null, phone_number: "5511999" },
} as unknown as React.ComponentProps<typeof ConversationHeader>["conversation"];

function renderHeader(conv = conversation) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConversationHeader conversation={conv} />
    </QueryClientProvider>,
  );
}

// Fork Sales: o cabeçalho deixou de ser uma fileira de dez botões. Ficam à vista só as ações do dia a dia (buscar, assumir/liberar,
// fechar/reabrir) e o resto mora no menu "Mais ações". O contrato abaixo substitui o do original, que recusava esse menu.
function barraDeAcoes() {
  const barra = screen.getByText("Fechar").closest("button")?.parentElement;
  expect(barra, "a barra de ações não renderizou").toBeTruthy();
  return barra as HTMLElement;
}

describe("header do inbox — não trava a largura da tela (fork Sales)", () => {
  it("nem a barra de ações nem a identidade impõem largura mínima — era isso que travava o header em 707px", () => {
    const { container } = renderHeader();
    const header = container.firstElementChild as HTMLElement;
    expect(header, "o header não renderizou").toBeTruthy();
    expect(header.className).toContain("cabecalho-conversa");

    const identidade = screen.getByRole("heading", { name: "Fulana" }).closest("div.min-w-0") as HTMLElement;
    expect(identidade, "a identidade não renderizou").toBeTruthy();
    for (const el of [identidade, barraDeAcoes()]) {
      expect(el.className.split(/\s+/), "`shrink-0` de volta: o header volta a travar a largura da tela").not.toContain("shrink-0");
      expect(el.className).toContain("min-w-0");
    }
  });

  it("à vista ficam as ações do dia a dia; o resto está no menu Mais ações", () => {
    renderHeader();
    const barra = barraDeAcoes();
    expect(barra.className).toContain("acoes-da-conversa");
    for (const rotulo of ["Buscar nesta conversa"]) {
      // a busca só existe com `onBuscar`; sem ele o botão nem entra
      expect(screen.queryByRole("button", { name: rotulo })).toBeNull();
    }
    for (const rotulo of ["Gerar contrato", "Fechar"]) {
      expect(barra.contains(screen.getByRole("button", { name: rotulo })), `"${rotulo}" tem de estar na barra`).toBe(true);
    }
    const gatilho = screen.getByRole("button", { name: "Mais ações" });
    expect(barra.contains(gatilho), "o gatilho do menu fica na barra").toBe(true);
    // As ações menos frequentes continuam montadas (diálogos e estados vivos), só dentro do menu.
    for (const rotulo of ["Assumir", "Transferir", "Arquivar"]) {
      const botao = screen.getByRole("button", { name: rotulo });
      expect(barra.contains(botao), `"${rotulo}" não pode ficar na fileira à vista`).toBe(false);
      expect(botao.closest(".mais-acoes"), `"${rotulo}" tem de estar no menu Mais ações`).toBeTruthy();
    }
  });

  it("com o selo do automático: nenhuma ação some, e o selo mora na linha de apoio sob o nome (#1625)", () => {
    renderHeader({
      ...conversation,
      assigned_to_user_id: "u-1",
      assigned_to_user_name: "Eu",
      assignee_kind: "user",
      bot_silenced_until: new Date(Date.now() + 10 * 60_000).toISOString(),
    } as typeof conversation);

    const selo = screen.getByTestId("badge-atendimento-humano");
    expect(selo.textContent).toBe("Automático volta em instantes");

    const barra = barraDeAcoes();
    expect(barra.contains(selo), "o selo voltou para a linha das ações").toBe(false);
    const linhaDoNome = screen.getByRole("heading", { name: "Fulana" }).parentElement as HTMLElement;
    expect(linhaDoNome.contains(selo), "o selo voltou para a linha do nome").toBe(false);
    expect(selo.closest(".linha-de-apoio"), "o selo mora na linha de apoio").toBeTruthy();

    for (const rotulo of ["Liberar", "Devolver ao automático", "Transferir", "Lembrar", "Fechar", "Arquivar"]) {
      expect(screen.getByRole("button", { name: rotulo }), `a ação "${rotulo}" sumiu`).toBeTruthy();
    }
  });

  it("clicar no nome abre a ficha do contato (e sem o atalho o nome é só texto)", () => {
    const aoAbrir = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = render(
      <QueryClientProvider client={client}>
        <ConversationHeader conversation={conversation} onAbrirFicha={aoAbrir} />
      </QueryClientProvider>,
    );
    screen.getByTestId("abrir-ficha-do-contato").click();
    expect(aoAbrir).toHaveBeenCalledTimes(1);
    unmount();
    renderHeader();
    expect(screen.queryByTestId("abrir-ficha-do-contato")).toBeNull();
  });

  it("no celular Assumir continua alcançável e a barra some com o teclado aberto (F2)", () => {
    renderHeader();
    const barra = barraDeAcoes();
    expect(barra.className).toContain("max-md:group-data-[teclado-aberto]/conversa:hidden");
    expect(barra.className).not.toMatch(/(?:^|\s)group-data-\[teclado-aberto\]/);
  });

  it("no celular o telefone sai do cabeçalho (continua na Ficha)", () => {
    renderHeader();
    const telefone = screen.getByText(/5511999|\+55/).closest("p") as HTMLElement;
    expect(telefone.className.split(/\s+/)).toContain("max-md:hidden");
  });

  it('"Ver contato" existe no DOM e só se cala onde há outra porta', () => {
    renderHeader();
    const link = screen.getByText("Ver contato").closest("a, button") as HTMLElement;
    expect(link, "o link para o contato sumiu do markup").toBeTruthy();
    const classes = `${link.className} ${link.parentElement?.className ?? ""}`;
    expect(classes, "sem `xl:hidden`, a duplicata volta").toContain("xl:hidden");
  });
});
