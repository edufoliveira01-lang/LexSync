import { describe, expect, it } from "vitest";
import { areaDaRota } from "@/lib/navigation/area-da-rota";

describe("areaDaRota", () => {
  it("dá o grupo do menu a que a rota pertence", () => {
    expect(areaDaRota("/app/contacts")).toBe("CRM");
    expect(areaDaRota("/app/contacts/abc")).toBe("CRM");
    expect(areaDaRota("/app/radar")).toBe("Atendimento");
    expect(areaDaRota("/app/connections")).toBe("Canais");
  });
  it("Configurações e o que mora em Organização viram Configurações", () => {
    expect(areaDaRota("/app/settings/profile")).toBe("Configurações");
    expect(areaDaRota("/app/team")).toBe("Configurações");
  });
  it("rota desconhecida não ganha rótulo", () => {
    expect(areaDaRota("/app/nada-disso")).toBeNull();
  });
});
