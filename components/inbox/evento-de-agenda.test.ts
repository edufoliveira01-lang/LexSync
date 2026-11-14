import { describe, expect, it } from "vitest";

import { tipoDoEvento } from "./EventoDaConversa";

describe("cápsula de agenda", () => {
  it.each([
    "Fulano agendou um atendimento — sex., 20/11, às 14h30 (Consulta)",
    "Fulano remarcou um atendimento — seg., 23/11, às 9h",
    "Fulano desmarcou um atendimento",
    "Agente de IA: marcou um compromisso na agenda",
  ])("%s é do tipo agenda", (t) => expect(tipoDoEvento(t)).toBe("agenda"));

  it("não rouba o que já tinha tipo", () => {
    expect(tipoDoEvento("Agente de IA: marcou o atendimento como «triagem»")).toBe("crm");
    expect(tipoDoEvento("Fulano programou uma mensagem")).toBe("programada");
  });
});
