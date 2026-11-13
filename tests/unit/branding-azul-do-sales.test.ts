import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { derivarMarca, extrairRegua } from "@/lib/branding/contraste";

describe("azul do Sales", () => {
  const regua = extrairRegua(fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8"));
  it("o #1678dc pinta o botão com o mesmo azul do Sales (grau 600, sem deslocamento)", () => {
    const m = derivarMarca("#1678dc", regua);
    expect(m.claro.accent.toLowerCase()).toBe("#1678dc");
    expect(m.claro.accentHover.toLowerCase()).toBe("#1262b6");
    expect(m.claro.deslocamento).toBe(0);
    // Texto branco no botão, como no Sales.
    expect(m.claro.accentFg.toLowerCase()).toBe("#ffffff");
  });
  it("qualquer outra cor continua passando pela régua de contraste", () => {
    const m = derivarMarca("#249715", regua);
    expect(m.claro.accent.toLowerCase()).not.toBe("#249715");
  });
});
