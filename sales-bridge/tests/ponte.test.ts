import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assinarRequisicao, chaveSso, emitirTokenSso, lerTokenSso, verificarRequisicao } from "../src/assinatura";
import { chaveDeIdempotencia } from "../src/ponte";
import { criarServidor } from "../src/servidor";

const SEGREDO = "segredo-de-teste-com-mais-de-32-caracteres!!";
const ATOR = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const DONO = "33333333-3333-4333-8333-333333333333";

/** Supabase falso: guarda as chamadas e devolve o que cada teste configurar. */
function falso() {
  const chamadas: { rpc: [string, any][]; createUser: any[]; generateLink: any[] } = { rpc: [], createUser: [], generateLink: [] };
  const estado: any = { orgs: {} as Record<string, any>, usuarioExiste: false, membros: new Set<string>(), rpcErro: {} as Record<string, any> };
  const db: any = {
    rpc: async (nome: string, args: any) => {
      chamadas.rpc.push([nome, args]);
      if (estado.rpcErro[nome]) return { data: null, error: estado.rpcErro[nome] };
      if (nome === "fn_create_tenant_with_owner") { const r = args.p_request; estado.orgs[r.slug] = { id: ORG, slug: r.slug, status: "active", display_name: r.display_name }; return { data: { id: ORG, slug: r.slug, display_name: r.display_name, created: true }, error: null }; }
      if (nome === "fn_accept_team_invite") { estado.membros.add(`${args.p_org}:${args.p_user}`); return { data: { ok: true }, error: null }; }
      if (nome === "fn_suspender_organizacao") { for (const o of Object.values<any>(estado.orgs)) if (o.id === args.p_org) o.status = "suspended"; return { data: { changed: true }, error: null }; }
      if (nome === "fn_reativar_organizacao") { for (const o of Object.values<any>(estado.orgs)) if (o.id === args.p_org) o.status = "active"; return { data: { changed: true }, error: null }; }
      return { data: null, error: { code: "x" } };
    },
    from: (tabela: string) => {
      const filtros: Record<string, any> = {};
      const q: any = { select: () => q, eq: (c: string, v: any) => { filtros[c] = v; return q; },
        maybeSingle: async () => tabela === "organizations" ? { data: estado.orgs[filtros.slug] ?? null, error: null } : { data: estado.membros.has(`${filtros.organization_id}:${filtros.user_id}`) ? { user_id: filtros.user_id } : null, error: null } };
      return q;
    },
    auth: { admin: {
      createUser: async (a: any) => { chamadas.createUser.push(a); return estado.usuarioExiste ? { data: { user: null }, error: { code: "email_exists", status: 422, message: "exists" } } : { data: { user: { id: DONO } }, error: null }; },
      generateLink: async (a: any) => { chamadas.generateLink.push(a); return { data: { user: { id: DONO }, properties: { hashed_token: "hash-de-teste" } }, error: null }; },
    } },
  };
  return { db, chamadas, estado };
}

let agora = 1_800_000_000;
let servidor: ReturnType<typeof criarServidor>; let base = ""; let f = falso();
beforeAll(async () => { servidor = criarServidor(f.db, { segredo: SEGREDO, atorId: ATOR, urlPublica: "https://atendimento.exemplo.com.br" }, () => agora); await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", () => r())); base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`; });
afterAll(() => new Promise<void>((r) => servidor.close(() => r())));
async function chamar(metodo: string, caminho: string, corpo?: unknown, ts = agora, segredo = SEGREDO) {
  const txt = corpo === undefined ? "" : JSON.stringify(corpo);
  const sig = assinarRequisicao(segredo, { metodo, caminho, corpo: txt }, ts);
  const r = await fetch(`${base}${caminho}`, { method: metodo, headers: { "Content-Type": "application/json", "X-Sales-Timestamp": String(ts), "X-Sales-Signature": sig }, body: txt || undefined });
  return { status: r.status, json: (await r.json().catch(() => ({}))) as any };
}

describe("assinatura", () => {
  it("aceita a assinatura correta e recusa adulteração, segredo errado e relógio fora da janela", () => {
    const d = { metodo: "post", caminho: "/v1/offices", corpo: '{"a":1}' };
    const s = assinarRequisicao(SEGREDO, d, agora);
    expect(verificarRequisicao(SEGREDO, d, String(agora), s, agora)).toBe(true);
    expect(verificarRequisicao(SEGREDO, { ...d, corpo: '{"a":2}' }, String(agora), s, agora)).toBe(false);
    expect(verificarRequisicao("outro-segredo-outro-segredo-outro-segredo", d, String(agora), s, agora)).toBe(false);
    expect(verificarRequisicao(SEGREDO, d, String(agora), s, agora + 301)).toBe(false);
    expect(verificarRequisicao(SEGREDO, d, undefined, s, agora)).toBe(false);
    // vetor fixo: o sistema Sales (server/src/atendimento/assinatura.ts) precisa gerar exatamente isto
    expect(assinarRequisicao("k", { metodo: "POST", caminho: "/v1/offices", corpo: "{}" }, 1700000000)).toBe("322b08ae3db4fa420707ca15fce80779bedf4c91c4887e525e00eae2c1bd0d1b");
  });
  it("token de entrada: chave própria por escritório, expira e não vale para outro escritório", () => {
    const t = emitirTokenSso(chaveSso(SEGREDO, "alfa"), { slug: "alfa", email: "a@b.com" }, agora);
    expect(lerTokenSso(SEGREDO, t, agora)).toMatchObject({ slug: "alfa", email: "a@b.com" });
    expect(lerTokenSso(SEGREDO, t, agora + 61)).toBeNull();
    const forjado = emitirTokenSso(chaveSso(SEGREDO, "beta"), { slug: "alfa", email: "a@b.com" }, agora); // assinado com a chave de outro escritório
    expect(lerTokenSso(SEGREDO, forjado, agora)).toBeNull();
    expect(lerTokenSso(SEGREDO, "lixo", agora)).toBeNull();
    expect(lerTokenSso(SEGREDO, `${t}.x`, agora)).toBeNull();
  });
  it("a chave de idempotência é estável por escritório", () => {
    expect(chaveDeIdempotencia("alfa")).toBe(chaveDeIdempotencia("alfa"));
    expect(chaveDeIdempotencia("alfa")).not.toBe(chaveDeIdempotencia("beta"));
    expect(chaveDeIdempotencia("alfa")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("servidor", () => {
  it("recusa chamada sem assinatura válida", async () => {
    expect((await fetch(`${base}/v1/offices`, { method: "POST", body: "{}" })).status).toBe(401);
    expect((await chamar("POST", "/v1/offices", { slug: "alfa" }, agora, "segredo-errado-segredo-errado-segredo-errado")).status).toBe(401);
    expect((await chamar("POST", "/v1/offices", { slug: "alfa" }, agora - 1000)).status).toBe(401);
    expect((await fetch(`${base}/health`)).status).toBe(200);
  });

  it("provisiona a empresa, cria o administrador e o vincula; repetir não duplica", async () => {
    f = falso(); servidor.removeAllListeners("request");
    const novo = criarServidor(f.db, { segredo: SEGREDO, atorId: ATOR, urlPublica: "https://atendimento.exemplo.com.br" }, () => agora);
    await new Promise<void>((r) => novo.listen(0, "127.0.0.1", () => r()));
    const b = `http://127.0.0.1:${(novo.address() as AddressInfo).port}`;
    const post = async (c: string, corpo: unknown) => { const txt = JSON.stringify(corpo); const r = await fetch(b + c, { method: "POST", headers: { "X-Sales-Timestamp": String(agora), "X-Sales-Signature": assinarRequisicao(SEGREDO, { metodo: "POST", caminho: c, corpo: txt }, agora) }, body: txt }); return { status: r.status, json: (await r.json()) as any }; };
    const r = await post("/v1/offices", { slug: "alfa", display_name: "Alfa Advocacia", owner_email: "  Dono@Alfa.com.br ", plan: "pro" });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ org_id: ORG, slug: "alfa", created: true, owner_user_id: DONO });
    const [nome, args] = f.chamadas.rpc[0];
    expect(nome).toBe("fn_create_tenant_with_owner");
    expect(args.p_actor).toBe(ATOR);
    expect(args.p_key).toBe(chaveDeIdempotencia("alfa"));
    expect(args.p_request).toMatchObject({ slug: "alfa", display_name: "Alfa Advocacia", owner_email: "dono@alfa.com.br", plan: "pro" });
    expect(f.chamadas.createUser[0]).toMatchObject({ email: "dono@alfa.com.br", email_confirm: true });
    expect(f.chamadas.rpc[1][0]).toBe("fn_accept_team_invite");
    expect(f.chamadas.rpc[1][1]).toMatchObject({ p_user: DONO, p_org: ORG, p_role: "admin" });
    // administrador que já existe no atendimento: reaproveita o usuário
    f.estado.usuarioExiste = true;
    const r2 = await post("/v1/offices", { slug: "beta", display_name: "Beta", owner_email: "x@beta.com" });
    expect(r2.json.owner_user_id).toBe(DONO);
    expect(f.chamadas.generateLink.length).toBe(1);
    // validações
    expect((await post("/v1/offices", { slug: "Ruim Slug", display_name: "X", owner_email: "x@y.com" })).status).toBe(400);
    expect((await post("/v1/offices", { slug: "ok-slug", display_name: "Ok", owner_email: "sem-arroba" })).status).toBe(400);
    f.estado.rpcErro.fn_create_tenant_with_owner = { code: "23505" };
    expect((await post("/v1/offices", { slug: "alfa", display_name: "Alfa", owner_email: "a@b.com" })).status).toBe(409);
    f.estado.rpcErro.fn_create_tenant_with_owner = { code: "42501" };
    expect((await post("/v1/offices", { slug: "alfa", display_name: "Alfa", owner_email: "a@b.com" })).json.codigo).toBe("ator_sem_permissao");
    await new Promise<void>((r) => novo.close(() => r()));
  });

  it("suspende, consulta e reativa; empresa inexistente dá 404", async () => {
    f = falso();
    const novo = criarServidor(f.db, { segredo: SEGREDO, atorId: ATOR, urlPublica: "https://atendimento.exemplo.com.br" }, () => agora);
    await new Promise<void>((r) => novo.listen(0, "127.0.0.1", () => r()));
    const b = `http://127.0.0.1:${(novo.address() as AddressInfo).port}`;
    const req = async (m: string, c: string, corpo?: unknown) => { const txt = corpo === undefined ? "" : JSON.stringify(corpo); const r = await fetch(b + c, { method: m, headers: { "X-Sales-Timestamp": String(agora), "X-Sales-Signature": assinarRequisicao(SEGREDO, { metodo: m, caminho: c, corpo: txt }, agora) }, body: txt || undefined }); return { status: r.status, json: (await r.json()) as any }; };
    expect((await req("GET", "/v1/offices/alfa")).status).toBe(404);
    await req("POST", "/v1/offices", { slug: "alfa", display_name: "Alfa", owner_email: "a@b.com" });
    expect((await req("GET", "/v1/offices/alfa")).json).toMatchObject({ status: "active", org_id: ORG });
    expect((await req("POST", "/v1/offices/alfa/suspend", { reason: "falta de pagamento" })).status).toBe(200);
    expect((await req("GET", "/v1/offices/alfa")).json.status).toBe("suspended");
    const susp = f.chamadas.rpc.find(([n]) => n === "fn_suspender_organizacao")![1];
    expect(susp).toMatchObject({ p_org: ORG, p_kind: "administrativa", p_motivo: "falta de pagamento", p_ator: ATOR });
    expect((await req("POST", "/v1/offices/alfa/suspend", { reason: "x" })).status).toBe(200); // motivo curto é completado (mínimo de 10 caracteres)
    expect(f.chamadas.rpc.filter(([n]) => n === "fn_suspender_organizacao")[1][1].p_motivo.length).toBeGreaterThanOrEqual(10);
    expect((await req("POST", "/v1/offices/alfa/reactivate")).status).toBe(200);
    expect((await req("GET", "/v1/offices/alfa")).json.status).toBe("active");
    await new Promise<void>((r) => novo.close(() => r()));
  });

  it("entrada direta: só com token válido, uma vez, para membro de empresa ativa", async () => {
    f = falso();
    const novo = criarServidor(f.db, { segredo: SEGREDO, atorId: ATOR, urlPublica: "https://atendimento.exemplo.com.br" }, () => agora);
    await new Promise<void>((r) => novo.listen(0, "127.0.0.1", () => r()));
    const b = `http://127.0.0.1:${(novo.address() as AddressInfo).port}`;
    f.estado.orgs.alfa = { id: ORG, slug: "alfa", status: "active", display_name: "Alfa" };
    const token = (slug = "alfa", email = "dono@alfa.com.br") => emitirTokenSso(chaveSso(SEGREDO, slug), { slug, email }, agora);
    // sem vínculo: recusa
    expect((await fetch(`${b}/sso?t=${token()}`)).status).toBe(403);
    f.estado.membros.add(`${ORG}:${DONO}`);
    const ok = await fetch(`${b}/sso?t=${token()}`);
    expect(ok.status).toBe(200);
    const html = await ok.text();
    expect(html).toContain('action="https://atendimento.exemplo.com.br/auth/confirm"');
    expect(html).toContain('name="token_hash" value="hash-de-teste"');
    expect(html).toContain('name="type" value="magiclink"');
    expect(ok.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(html).toContain('name="next" value="/app"');
    // abrir a conversa de um telefone: só esse destino fixo é aceito
    const abrir = await (await fetch(`${b}/sso?t=${token()}&next=${encodeURIComponent("/app/abrir-conversa?telefone=5513999991111")}`)).text();
    expect(abrir).toContain('name="next" value="/app/abrir-conversa?telefone=5513999991111"');
    const externo = await (await fetch(`${b}/sso?t=${token()}&next=${encodeURIComponent("https://evil.example")}`)).text();
    expect(externo).toContain('name="next" value="/app"');
    // uso único
    const t = token(); expect((await fetch(`${b}/sso?t=${t}`)).status).toBe(200); expect((await fetch(`${b}/sso?t=${t}`)).status).toBe(400);
    // token forjado ou expirado
    expect((await fetch(`${b}/sso?t=${emitirTokenSso(chaveSso(SEGREDO, "beta"), { slug: "alfa", email: "x@y.com" }, agora)}`)).status).toBe(400);
    expect((await fetch(`${b}/sso?t=${emitirTokenSso(chaveSso(SEGREDO, "alfa"), { slug: "alfa", email: "dono@alfa.com.br" }, agora - 120)}`)).status).toBe(400);
    // empresa suspensa
    f.estado.orgs.alfa.status = "suspended";
    expect((await fetch(`${b}/sso?t=${token()}`)).status).toBe(403);
    await new Promise<void>((r) => novo.close(() => r()));
  });
});
