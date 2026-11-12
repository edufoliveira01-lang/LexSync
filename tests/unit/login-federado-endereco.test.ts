import { describe, expect, it } from "vitest";
import { origemDoSistema } from "@/lib/auth/enderecoDoSistema";

describe("origemDoSistema", () => {
  it("aceita host ou URL e devolve só a origem https", () => {
    expect(origemDoSistema("sistema.escritorio.com.br")).toBe("https://sistema.escritorio.com.br");
    expect(origemDoSistema(" https://Sistema.Escritorio.com.br/login?x=1 ")).toBe("https://sistema.escritorio.com.br");
  });
  it("recusa http, credenciais, IP, hosts sem ponto e lixo", () => {
    for (const x of ["", "http://a.com", "https://u:p@a.com", "10.0.0.1", "localhost", "https://[::1]", "javascript:alert(1)", "a b.com"]) {
      expect(origemDoSistema(x)).toBeNull();
    }
  });
});
