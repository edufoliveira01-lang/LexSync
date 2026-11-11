import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.SALES_PAINEL_URL = "https://painel.exemplo.com";
process.env.CONTRATOS_SEGREDO = "s".repeat(40);

type Linha = { id: string; type: string; media_storage_path: string | null; media_mime: string | null; sent_at: string; created_at: string; metadata: Record<string, unknown> | null };
const banco = vi.hoisted(() => ({ mensagens: [] as Array<Record<string, unknown>>, atualizacoes: [] as Array<Record<string, unknown>>, urlAssinada: "https://storage.exemplo.com/x?token=1" as string | null }));

vi.mock("@/lib/supabase/admin", () => {
  const consulta = () => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "not", "order", "limit"]) q[m] = () => q;
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: banco.mensagens, error: null }).then(ok);
    q.update = (patch: Record<string, unknown>) => { banco.atualizacoes.push(patch); return q; };
    return q;
  };
  return {
    createAdminClient: () => ({
      from: () => consulta(),
      storage: { from: () => ({ createSignedUrl: async () => (banco.urlAssinada ? { data: { signedUrl: banco.urlAssinada }, error: null } : { data: null, error: { message: "x" } }) }) },
    }),
  };
});
vi.mock("@/lib/sales/contrato-na-conversa", () => ({ slugDaOrg: async () => "alfa" }));

import { extensaoDoArquivo, listarDocumentosRecebidos, salvarDocumentoRecebido } from "@/lib/sales/documentos-do-chat";

const msg = (id: string, extra: Partial<Linha> = {}): Linha => ({
  id, type: "document", media_storage_path: `org/${id}.pdf`, media_mime: "application/pdf", sent_at: "2026-11-10T23:13:00.000Z", created_at: "2026-11-10T23:13:00.000Z", metadata: { media_filename: "Documento_1.pdf" }, ...extra,
});

beforeEach(() => { banco.mensagens = []; banco.atualizacoes = []; banco.urlAssinada = "https://storage.exemplo.com/x?token=1"; });

describe("extensão do arquivo", () => {
  it("pelo nome; sem nome, pelo tipo MIME", () => {
    expect(extensaoDoArquivo("Laudo.PDF", null)).toBe("pdf");
    expect(extensaoDoArquivo("foto.jpeg", null)).toBe("jpeg");
    expect(extensaoDoArquivo("", "image/jpeg")).toBe("jpg");
    expect(extensaoDoArquivo(null, "image/png")).toBe("png");
    expect(extensaoDoArquivo(null, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("docx");
    expect(extensaoDoArquivo(null, null)).toBe("pdf");
  });
});

describe("listar o que o cliente mandou", () => {
  it("devolve só o que ainda não foi salvo, com o código, o tipo de arquivo e o nome", async () => {
    banco.mensagens = [msg("a1"), msg("b2", { type: "image", metadata: null }), msg("c3", { metadata: { sales_documento: { tipo: "PARTE MÉDICA", titulo: "Laudo", situacao: "enfileirado" } } })];
    const r = await listarDocumentosRecebidos("org", "conv");
    expect(r.map((d) => d.referencia)).toEqual(["a1", "b2"]);
    expect(r[0]).toMatchObject({ tipo_de_arquivo: "documento", nome_do_arquivo: "Documento_1.pdf" });
    expect(r[1]).toMatchObject({ tipo_de_arquivo: "imagem", nome_do_arquivo: "" });
  });
});

describe("salvar um documento recebido", () => {
  const base = { orgId: "org", conversationId: "conv", tipo: "PARTE MÉDICA" as const, titulo: "Laudo da coluna", telefone: "+5513974045973", cpf: "225.188.548-00" };

  it("manda ao Sales o tipo, o título, o CPF e um link temporário (nunca o arquivo), e marca a mensagem como salva", async () => {
    banco.mensagens = [msg("a1")];
    const pedidos: Array<{ url: string; corpo: Record<string, unknown> }> = [];
    const http = (async (url: string, init: RequestInit) => { pedidos.push({ url: String(url), corpo: JSON.parse(String(init.body)) }); return new Response(JSON.stringify({ situacao: "aguardando_assinatura" }), { status: 201 }); }) as unknown as typeof fetch;
    const r = await salvarDocumentoRecebido({ ...base, referencia: "a1", http });
    expect(r.situacao).toBe("aguardando_assinatura");
    expect(pedidos[0]!.url).toBe("https://painel.exemplo.com/contratos/v1/offices/alfa/documentos");
    expect(pedidos[0]!.corpo).toMatchObject({ origem_ref: "a1", tipo: "PARTE MÉDICA", titulo: "Laudo da coluna", extensao: "pdf", cpf: "225.188.548-00", telefone: "+5513974045973", url: "https://storage.exemplo.com/x?token=1" });
    expect(JSON.stringify(pedidos[0]!.corpo).length).toBeLessThan(2000);
    expect(banco.atualizacoes[0]).toMatchObject({ metadata: { sales_documento: { tipo: "PARTE MÉDICA", titulo: "Laudo da coluna", situacao: "aguardando_assinatura" } } });
  });

  it("referência de outra conversa (ou inexistente) não salva nada", async () => {
    banco.mensagens = [msg("a1")];
    let chamou = false;
    const http = (async () => { chamou = true; return new Response("{}"); }) as unknown as typeof fetch;
    const r = await salvarDocumentoRecebido({ ...base, referencia: "de-outro-cliente", http });
    expect(r.situacao).toBe("nao_encontrado");
    expect(chamou).toBe(false);
  });

  it("documento já salvo não é enviado de novo", async () => {
    banco.mensagens = [msg("a1", { metadata: { sales_documento: { tipo: "PARTE MÉDICA", titulo: "x", situacao: "enfileirado" } } })];
    let chamou = false;
    const http = (async () => { chamou = true; return new Response("{}"); }) as unknown as typeof fetch;
    expect((await salvarDocumentoRecebido({ ...base, referencia: "a1", http })).situacao).toBe("ja_recebido");
    expect(chamou).toBe(false);
  });

  it("escritório sem drive: não marca a mensagem (nada foi guardado) e devolve a situação", async () => {
    banco.mensagens = [msg("a1")];
    const http = (async () => new Response(JSON.stringify({ situacao: "drive_nao_configurado" }), { status: 201 })) as unknown as typeof fetch;
    expect((await salvarDocumentoRecebido({ ...base, referencia: "a1", http })).situacao).toBe("drive_nao_configurado");
    expect(banco.atualizacoes).toHaveLength(0);
  });

  it("sem link do storage ou Sales fora do ar: devolve falha com mensagem, sem marcar", async () => {
    banco.mensagens = [msg("a1")];
    banco.urlAssinada = null;
    expect((await salvarDocumentoRecebido({ ...base, referencia: "a1" })).situacao).toBe("sem_arquivo");
    banco.urlAssinada = "https://storage.exemplo.com/x";
    const http = (async () => new Response(JSON.stringify({ error: "fora do ar" }), { status: 502 })) as unknown as typeof fetch;
    const r = await salvarDocumentoRecebido({ ...base, referencia: "a1", http });
    expect(r.situacao).toBe("sem_sales");
    expect(banco.atualizacoes).toHaveLength(0);
  });
});
