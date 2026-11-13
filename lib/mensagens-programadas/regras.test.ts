import { describe, expect, it } from "vitest";

import { clienteRespondeuDepois, deveCancelarPorResposta, problemaDoHorario } from "./regras";

const AGORA = new Date("2026-11-13T12:00:00Z");

describe("problemaDoHorario", () => {
  it("aceita um horário daqui a uma hora", () => {
    expect(problemaDoHorario("2026-11-13T13:00:00Z", AGORA)).toBeNull();
  });
  it("recusa horário passado ou quase agora", () => {
    expect(problemaDoHorario("2026-11-13T11:00:00Z", AGORA)).toBe("muito_cedo");
    expect(problemaDoHorario("2026-11-13T12:00:30Z", AGORA)).toBe("muito_cedo");
  });
  it("recusa mais de um ano à frente", () => {
    expect(problemaDoHorario("2028-01-01T00:00:00Z", AGORA)).toBe("muito_longe");
  });
  it("recusa data inválida", () => {
    expect(problemaDoHorario("amanhã", AGORA)).toBe("invalido");
  });
});

describe("cancelar porque o cliente respondeu", () => {
  const criada = "2026-11-13T12:00:00Z";
  it("cliente escreveu depois de programar: cancela quando a opção está ligada", () => {
    expect(deveCancelarPorResposta({ cancelOnReply: true, createdAt: criada, lastInboundAt: "2026-11-13T12:30:00Z" })).toBe(true);
  });
  it("opção desligada (envio permanente): nunca cancela", () => {
    expect(deveCancelarPorResposta({ cancelOnReply: false, createdAt: criada, lastInboundAt: "2026-11-13T12:30:00Z" })).toBe(false);
  });
  it("cliente escreveu ANTES de programar: não conta", () => {
    expect(clienteRespondeuDepois(criada, "2026-11-13T11:00:00Z")).toBe(false);
  });
  it("cliente nunca escreveu: não cancela", () => {
    expect(deveCancelarPorResposta({ cancelOnReply: true, createdAt: criada, lastInboundAt: null })).toBe(false);
  });
  it("datas inválidas não cancelam (envia o que foi pedido)", () => {
    expect(clienteRespondeuDepois("lixo", "2026-11-13T12:30:00Z")).toBe(false);
  });
});
