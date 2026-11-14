import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GradeDaAgenda } from "./GradeDaAgenda";

const QUARTA = new Date("2026-09-16T12:00:00-03:00");
const FUSO = "America/Sao_Paulo";
const pessoas = [{ id: "u1", nome: "Marcelo Silva", trilha: 1 }] as never;

function grade(agendamentos: unknown[]) {
  return render(<GradeDaAgenda visao="semana" ancora={QUARTA} agora={QUARTA} fuso={FUSO} agendamentos={agendamentos as never} pessoas={pessoas} />);
}

describe("legenda do bloco ao passar o mouse", () => {
  it("bloco do Google mostra o título INTEIRO, o horário, a agenda do Google e o responsável", () => {
    grade([{ id: "g1", titulo: "LIGAÇÃO ORIENTAR PMS - MARIA DA SILVA SANTOS", responsavelId: "u1", comeca: "2026-09-16T10:00:00-03:00", termina: "2026-09-16T11:00:00-03:00", origem: "google_sync", situacao: "confirmed", agendaDoGoogle: "ATENDIMENTO MARCELO" }]);
    const bloco = screen.getByTestId("agendamento-g1");
    const legenda = bloco.getAttribute("title") ?? "";
    expect(legenda).toContain("LIGAÇÃO ORIENTAR PMS - MARIA DA SILVA SANTOS");
    expect(legenda).toContain("10:00");
    expect(legenda).toContain("ATENDIMENTO MARCELO");
    expect(legenda).toContain("Marcelo Silva");
    expect(bloco).toBeDisabled(); // continua inerte: a legenda não vira ação
  });

  it("'Ocupado' sem título (agenda não marcada): a legenda não inventa nome de agenda", () => {
    grade([{ id: "g2", titulo: "Ocupado", responsavelId: "u1", comeca: "2026-09-16T10:00:00-03:00", termina: "2026-09-16T11:00:00-03:00", origem: "google_sync", situacao: "confirmed" }]);
    const legenda = screen.getByTestId("agendamento-g2").getAttribute("title") ?? "";
    expect(legenda).toContain("Ocupado");
    expect(legenda).not.toMatch(/Agenda do Google:/);
  });

  it("agendamento nosso também ganha a legenda, com quem será atendido", () => {
    grade([{ id: "n1", titulo: "Consulta", responsavelId: "u1", comeca: "2026-09-16T14:00:00-03:00", termina: "2026-09-16T15:00:00-03:00", origem: "ui", situacao: "confirmed", quemSeraAtendido: "Maria" }]);
    const legenda = screen.getByTestId("agendamento-n1").getAttribute("title") ?? "";
    expect(legenda).toContain("Consulta");
    expect(legenda).toContain("Maria");
  });
});
