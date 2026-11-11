import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerTokenSso, verificarRequisicao } from "./assinatura.js";
import { ErroPonte, prepararEntrada, provisionarEmpresa, reativarEmpresa, statusDaEmpresa, suspenderEmpresa, type ConfigPonte } from "./ponte.js";

export interface ConfigServidor extends ConfigPonte { segredo: string }
type Cliente = Pick<SupabaseClient, "rpc" | "from" | "auth">;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const LIMITE = 64 * 1024;
function corpoDe(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = []; let total = 0;
    req.on("data", (c: Buffer) => { total += c.length; if (total > LIMITE) { reject(new ErroPonte("Requisição grande demais.", 413, "grande_demais")); req.destroy(); } else partes.push(c); });
    req.on("end", () => resolve(Buffer.concat(partes).toString("utf8")));
    req.on("error", reject);
  });
}
const json = (res: ServerResponse, status: number, corpo: unknown) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(corpo)); };
const pagina = (res: ServerResponse, status: number, html: string) => {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action *", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
  res.end(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#222">${html}</body></html>`);
};

/** Servidor HTTP da ponte. O cliente do Supabase é injetado (testes usam um falso). */
export function criarServidor(db: Cliente, cfg: ConfigServidor, agora: () => number = () => Math.floor(Date.now() / 1000)): Server {
  const usados = new Map<string, number>(); // código de entrada já usado (uso único)
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://ponte");
      const metodo = (req.method || "GET").toUpperCase();
      if (metodo === "GET" && url.pathname === "/health") return json(res, 200, { ok: true });

      if (metodo === "GET" && url.pathname === "/sso") {
        const t = lerTokenSso(cfg.segredo, url.searchParams.get("t") || "", agora());
        for (const [k, exp] of usados) if (exp < agora()) usados.delete(k);
        if (!t || usados.has(t.jti)) return pagina(res, 400, "<p>Este link de entrada expirou. Volte ao sistema e clique em Atendimento de novo.</p>");
        usados.set(t.jti, t.exp);
        try {
          const e = await prepararEntrada(db, t.slug, t.email);
          if (e.org_status !== "active") return pagina(res, 403, "<p>O atendimento deste escritório está suspenso. Fale com o administrador do sistema.</p>");
          // Só um destino fixo é aceito (abrir a conversa de um telefone); qualquer outra coisa cai em /app.
          const pedido = url.searchParams.get("next") || "";
          const destinoDepois = /^\/app\/abrir-conversa\?telefone=\d{8,15}$/.test(pedido) ? pedido : "/app";
          const destino = `${cfg.urlPublica.replace(/\/$/, "")}/auth/confirm`;
          // Formulário que se envia sozinho; o botão cobre quem tem scripts bloqueados.
          return pagina(res, 200, `<form id="f" method="post" action="${esc(destino)}"><input type="hidden" name="token_hash" value="${esc(e.token_hash)}"><input type="hidden" name="type" value="magiclink"><input type="hidden" name="next" value="${esc(destinoDepois)}"><p>Entrando no atendimento…</p><noscript><button type="submit">Continuar</button></noscript></form><script>document.getElementById('f').submit()</script>`);
        } catch (e) {
          if (e instanceof ErroPonte) return pagina(res, e.status, `<p>${esc(e.message)}</p>`);
          throw e;
        }
      }

      if (!url.pathname.startsWith("/v1/")) return json(res, 404, { error: "Não encontrado." });
      const corpo = metodo === "GET" ? "" : await corpoDe(req);
      const h = (n: string) => { const v = req.headers[n]; return Array.isArray(v) ? v[0] : v; };
      if (!verificarRequisicao(cfg.segredo, { metodo, caminho: url.pathname, corpo }, h("x-sales-timestamp"), h("x-sales-signature"), agora())) return json(res, 401, { error: "Assinatura inválida." });
      let dados: Record<string, unknown> = {};
      if (corpo) { try { dados = JSON.parse(corpo) as Record<string, unknown>; } catch { return json(res, 400, { error: "JSON inválido." }); } }

      const rota = url.pathname.split("/").filter(Boolean); // v1, offices, :slug, acao
      if (rota[1] !== "offices") return json(res, 404, { error: "Não encontrado." });
      if (metodo === "POST" && rota.length === 2) return json(res, 201, await provisionarEmpresa(db, cfg, dados as never));
      const slug = rota[2] || "";
      if (metodo === "GET" && rota.length === 3) return json(res, 200, await statusDaEmpresa(db, slug));
      if (metodo === "POST" && rota[3] === "suspend") return json(res, 200, await suspenderEmpresa(db, cfg, slug, String(dados.reason ?? "")));
      if (metodo === "POST" && rota[3] === "reactivate") return json(res, 200, await reativarEmpresa(db, cfg, slug));
      return json(res, 404, { error: "Não encontrado." });
    } catch (e) {
      if (e instanceof ErroPonte) return json(res, e.status, { error: e.message, codigo: e.codigo });
      console.error("[ponte] erro inesperado:", e instanceof Error ? e.message : e);
      return json(res, 500, { error: "Erro interno." });
    }
  });
}
