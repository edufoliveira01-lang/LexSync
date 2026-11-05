import { defineConfig } from "vitest/config";
// `css.postcss` vazio: sem isto o Vite procura o postcss.config da raiz do DeskcommCRM (que não faz parte da ponte).
export default defineConfig({ css: { postcss: { plugins: [] } }, test: { environment: "node", include: ["tests/**/*.test.ts"], root: __dirname } });
