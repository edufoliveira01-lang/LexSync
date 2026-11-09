import { describe, expect, it } from "vitest";

import { tabToFilter } from "@/components/inbox/InboxLayout";

describe("aba 'Aguardando docs' do Inbox", () => {
  it("lista as conversas abertas de quem já assinou (etiqueta posta pelo sistema), de qualquer atendente ou da IA", () => {
    expect(tabToFilter("docs")).toEqual({ exclude_finished: true, tag: "Contrato assinado" });
  });
  it("as outras abas continuam sem etiqueta própria", () => {
    for (const aba of ["ai", "unassigned", "mine", "all", "closed", "archived"] as const) expect(tabToFilter(aba).tag).toBeUndefined();
  });
});
