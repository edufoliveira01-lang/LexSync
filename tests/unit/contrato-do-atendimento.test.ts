import { createHash, createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { mensagemDoContrato } from "@/components/inbox/GerarContrato";
import { temContratoPendente } from "@/hooks/inbox/useAcompanharContratos";
import { MARCA_DE_EVENTO } from "@/lib/inbox/evento-na-conversa-marca";
import { assinar, configDosContratos, ErroContratoSales, estadoDoContrato, pedirContrato } from "@/lib/sales/contratos";

const SEGREDO = "c".repeat(40);
const dados = { nome: "Ana Maria", cpf: "52998224725", logradouro: "Rua A" };

describe("contrato do atendimento (Fork Sales)", () => {
  it("só liga com a URL do painel e um segredo de 32+ caracteres", () => {
    expect(configDosContratos({})).toBeNull();
    expect(configDosContratos({ SALES_PAINEL_URL: "https://p.exemplo/", CONTRATOS_SEGREDO: "curto" })).toBeNull();
    expect(configDosContratos({ SALES_PAINEL_URL: "https://p.exemplo/", CONTRATOS_SEGREDO: SEGREDO })).toEqual({ url: "https://p.exemplo", segredo: SEGREDO });
  });

  it("assina com a mesma regra do painel: HMAC de ts.MÉTODO.caminho.sha256(corpo)", () => {
    const esperado = createHmac("sha256", SEGREDO).update(`10.POST./v1/offices/alfa/contratos.${createHash("sha256").update("{}").digest("hex")}`).digest("hex");
    expect(assinar(SEGREDO, "post", "/v1/offices/alfa/contratos", "{}", 10)).toBe(esperado);
  });

  it("pede o contrato ao painel, assinado, e devolve o link", async () => {
    vi.stubEnv("SALES_PAINEL_URL", "https://p.exemplo");
    vi.stubEnv("CONTRATOS_SEGREDO", SEGREDO);
    const chamadas: { url: string; init: RequestInit }[] = [];
    const http = (async (url: string, init: RequestInit) => { chamadas.push({ url, init }); return new Response(JSON.stringify({ id: 7, pessoa_id: 1, status: "enviado", sign_url: "https://z/assina", email_enviado: true }), { status: 201 }); }) as unknown as typeof fetch;
    const r = await pedirContrato("alfa", dados, http);
    expect(r).toMatchObject({ id: 7, sign_url: "https://z/assina" });
    expect(chamadas[0].url).toBe("https://p.exemplo/contratos/v1/offices/alfa/contratos");
    const h = chamadas[0].init.headers as Record<string, string>;
    expect(h["x-sales-signature"]).toBe(assinar(SEGREDO, "POST", "/v1/offices/alfa/contratos", String(chamadas[0].init.body), Number(h["x-sales-timestamp"])));
    vi.unstubAllEnvs();
  });

  it("erro do painel vira mensagem para o atendente; sem configuração, 503", async () => {
    vi.stubEnv("SALES_PAINEL_URL", "https://p.exemplo");
    vi.stubEnv("CONTRATOS_SEGREDO", SEGREDO);
    const recusa = (async () => new Response(JSON.stringify({ error: "CPF inválido." }), { status: 422 })) as unknown as typeof fetch;
    await expect(pedirContrato("alfa", dados, recusa)).rejects.toMatchObject({ message: "CPF inválido.", status: 422 });
    vi.unstubAllEnvs();
    await expect(estadoDoContrato("alfa", 1)).rejects.toBeInstanceOf(ErroContratoSales);
  });

  it("a mensagem ao cliente lista os 3 documentos, com o primeiro nome e a cópia por e-mail quando houver", () => {
    const docs = [{ nome: "Procuração", sign_url: "https://z/1" }, { nome: "Declaração de hipossuficiência", sign_url: "https://z/2" }, { nome: "Contrato e declarações", sign_url: "https://z/3" }];
    const m = mensagemDoContrato("Maria Aparecida", docs, true);
    expect(m).toContain("Maria"); expect(m).not.toContain("Aparecida");
    expect(m).toContain("1) Procuração:\nhttps://z/1"); expect(m).toContain("3) Contrato e declarações:\nhttps://z/3"); expect(m).toContain("os 3 documentos");
    expect(m).toContain("e-mail");
    expect(mensagemDoContrato("Maria", [docs[0]], false)).not.toContain("e-mail");
    // um link só (modelo com complementares): uma assinatura vale para todos
    const unico = mensagemDoContrato("Maria Souza", [{ nome: "Documentos do cliente", sign_url: "https://z/unico" }], true);
    expect(unico).toContain("https://z/unico"); expect(unico).toContain("única assinatura"); expect(unico).not.toContain("1)");
  });

  it("acompanha enquanto houver contrato enviado sem o assinado do mesmo número", () => {
    const env = (n: number) => ({ body: `${MARCA_DE_EVENTO}Contrato enviado para assinatura — Ana · nº ${n}` });
    const ass = (n: number) => ({ body: `${MARCA_DE_EVENTO}Contrato assinado — nº ${n}` });
    expect(temContratoPendente([])).toBe(false);
    expect(temContratoPendente([env(1)])).toBe(true);
    expect(temContratoPendente([env(1), ass(1)])).toBe(false);
    expect(temContratoPendente([env(1), ass(1), env(2)])).toBe(true);
    expect(temContratoPendente([{ body: "Contrato enviado (nota comum)" }])).toBe(false);
  });
});
