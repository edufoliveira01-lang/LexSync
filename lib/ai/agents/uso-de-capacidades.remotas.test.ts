import { describe, expect, it } from "vitest";

import { montarUsoDeCapacidades } from "./uso-de-capacidades";

describe("capacidades de servidor externo na aba Capacidades", () => {
  it("as consultas do Sales têm nome legível e NÃO aparecem como 'removida do sistema'", () => {
    const r = montarUsoDeCapacidades({
      ligadas: ["mcp_externo:leitura:consultar_cliente", "mcp_externo:leitura:financeiro_do_cliente"],
      catalogo: [],
      linhas: [],
      janelaEmDias: 30,
      agora: Date.parse("2026-11-14T12:00:00Z"),
    });
    const cliente = r.find((c) => c.name === "mcp_externo:leitura:consultar_cliente")!;
    expect(cliente.rotulo).toBe("Consultar o cadastro do cliente (Sales)");
    expect(cliente.o_que_toca).toBe("Servidor de ferramentas externo (consulta)");
    expect(r.find((c) => c.name.endsWith("financeiro_do_cliente"))!.rotulo).toBe("Ver o financeiro do cliente (Sales)");
    expect(r.some((c) => c.o_que_toca === "Capacidade removida do sistema")).toBe(false);
  });

  it("ferramenta de servidor externo desconhecida mostra o nome dela, com a origem", () => {
    const r = montarUsoDeCapacidades({ ligadas: ["mcp_externo:leitura:buscar_pedido"], catalogo: [], linhas: [], janelaEmDias: 30, agora: 0 });
    expect(r[0]!.rotulo).toBe("buscar_pedido (servidor externo)");
  });

  it("id sem prefixo que saiu do catálogo continua 'removida do sistema'", () => {
    const r = montarUsoDeCapacidades({ ligadas: ["crm_ferramenta_que_sumiu"], catalogo: [], linhas: [], janelaEmDias: 30, agora: 0 });
    expect(r[0]!.o_que_toca).toBe("Capacidade removida do sistema");
  });
});
