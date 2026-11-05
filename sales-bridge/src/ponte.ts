import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export class ErroPonte extends Error {
  constructor(message: string, public status = 400, public codigo = "erro") { super(message); }
}
export interface ConfigPonte { atorId: string; urlPublica: string }
export interface PedidoEmpresa { slug: string; display_name: string; owner_email: string; owner_name?: string; plan?: string; cnpj?: string; legal_name?: string }
const SLUG = /^[a-z0-9-]{2,40}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** UUID estável por escritório: repetir o provisionamento devolve a mesma empresa (idempotência do DeskcommCRM). */
export function chaveDeIdempotencia(slug: string): string {
  const h = createHash("sha256").update(`sales-bridge:${slug}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

type Cliente = Pick<SupabaseClient, "rpc" | "from" | "auth">;

async function empresaPorSlug(db: Cliente, slug: string): Promise<{ id: string; status: string; slug: string; display_name: string }> {
  if (!SLUG.test(slug)) throw new ErroPonte("Identificador do escritório inválido.", 400, "slug_invalido");
  const { data, error } = await db.from("organizations").select("id, slug, status, display_name").eq("slug", slug).maybeSingle();
  if (error) throw new ErroPonte("Não foi possível consultar a empresa.", 502, "consulta_falhou");
  if (!data) throw new ErroPonte("Empresa não encontrada no atendimento.", 404, "nao_encontrada");
  return data as { id: string; status: string; slug: string; display_name: string };
}

/** Descobre o usuário (criando se preciso) sem e-mail de convite: a pessoa entra pela entrada direta. */
async function usuarioDoDono(db: Cliente, email: string, nome?: string): Promise<string> {
  const criado = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: nome ? { full_name: nome } : {} });
  if (!criado.error && criado.data?.user?.id) return criado.data.user.id;
  const existe = criado.error && (criado.error.code === "email_exists" || criado.error.status === 422 || /already.*regist|exists/i.test(criado.error.message ?? ""));
  if (!existe) throw new ErroPonte("Não foi possível criar o usuário administrador no atendimento.", 502, "usuario_falhou");
  const link = await db.auth.admin.generateLink({ type: "magiclink", email });
  const id = link.data?.user?.id;
  if (link.error || !id) throw new ErroPonte("Não foi possível localizar o usuário administrador.", 502, "usuario_falhou");
  return id;
}

export async function provisionarEmpresa(db: Cliente, cfg: ConfigPonte, p: PedidoEmpresa) {
  if (!SLUG.test(p.slug)) throw new ErroPonte("Identificador do escritório inválido.", 400, "slug_invalido");
  if (!p.display_name || p.display_name.length < 2 || p.display_name.length > 120) throw new ErroPonte("Nome do escritório inválido.", 400, "nome_invalido");
  const email = String(p.owner_email || "").trim().toLowerCase();
  if (!EMAIL.test(email)) throw new ErroPonte("E-mail do administrador inválido.", 400, "email_invalido");
  const pedido = { display_name: p.display_name.trim(), slug: p.slug, ...(p.legal_name ? { legal_name: p.legal_name } : {}), ...(p.cnpj ? { cnpj: p.cnpj } : {}), plan: ["standard", "pro", "enterprise"].includes(p.plan || "") ? p.plan : "standard", owner_email: email };
  const { data, error } = await db.rpc("fn_create_tenant_with_owner", { p_actor: cfg.atorId, p_key: chaveDeIdempotencia(p.slug), p_request: pedido, p_hash: createHash("sha256").update(JSON.stringify(pedido)).digest("hex") });
  if (error) {
    if (error.code === "23505" || error.code === "22023") throw new ErroPonte("Já existe uma empresa com este identificador (ou os dados mudaram).", 409, "conflito");
    if (error.code === "42501") throw new ErroPonte("O administrador da plataforma configurado na ponte não tem permissão.", 500, "ator_sem_permissao");
    throw new ErroPonte("Não foi possível criar a empresa no atendimento.", 502, "criar_falhou");
  }
  const org = data as { id: string; slug: string; created: boolean };
  const donoId = await usuarioDoDono(db, email, p.owner_name);
  const vinculo = await db.rpc("fn_accept_team_invite", { p_user: donoId, p_org: org.id, p_role: "admin", p_invited_by: cfg.atorId, p_issued_at: null, p_invited_at: null, p_interface_settings: { preset: "completa" } });
  if (vinculo.error) throw new ErroPonte("A empresa foi criada, mas o administrador não pôde ser vinculado. Repita o provisionamento.", 502, "vinculo_falhou");
  return { org_id: org.id, slug: org.slug, created: Boolean(org.created), owner_user_id: donoId };
}

export async function statusDaEmpresa(db: Cliente, slug: string) {
  const o = await empresaPorSlug(db, slug);
  return { org_id: o.id, slug: o.slug, status: o.status, display_name: o.display_name };
}
export async function suspenderEmpresa(db: Cliente, cfg: ConfigPonte, slug: string, motivo: string) {
  const o = await empresaPorSlug(db, slug);
  const texto = (motivo || "Escritório suspenso no painel de assinaturas").trim().padEnd(10, ".").slice(0, 500);
  const { data, error } = await db.rpc("fn_suspender_organizacao", { p_org: o.id, p_kind: "administrativa", p_motivo: texto, p_ator: cfg.atorId });
  if (error) throw new ErroPonte(error.code === "40001" ? "Outra operação está em andamento. Tente de novo em instantes." : "Não foi possível suspender a empresa.", error.code === "40001" ? 409 : 502, "suspender_falhou");
  return { slug, ...(data as object) };
}
export async function reativarEmpresa(db: Cliente, cfg: ConfigPonte, slug: string) {
  const o = await empresaPorSlug(db, slug);
  const { data, error } = await db.rpc("fn_reativar_organizacao", { p_org: o.id, p_kind_exigido: "administrativa", p_ator: cfg.atorId });
  if (error) throw new ErroPonte(error.code === "40001" ? "Outra operação está em andamento. Tente de novo em instantes." : "Não foi possível reativar a empresa.", error.code === "40001" ? 409 : 502, "reativar_falhou");
  return { slug, ...(data as object) };
}

/** Entrada direta: só entra quem já é membro da empresa. Devolve o código de uso único que o DeskcommCRM troca por sessão. */
export async function prepararEntrada(db: Cliente, slug: string, email: string): Promise<{ token_hash: string; org_status: string }> {
  if (!EMAIL.test(email)) throw new ErroPonte("E-mail inválido.", 400, "email_invalido");
  const org = await empresaPorSlug(db, slug);
  const link = await db.auth.admin.generateLink({ type: "magiclink", email: email.trim().toLowerCase() });
  const userId = link.data?.user?.id;
  const hashed = link.data?.properties?.hashed_token;
  if (link.error || !userId || !hashed || !UUID.test(userId)) throw new ErroPonte("Esta pessoa não tem acesso ao atendimento.", 403, "sem_acesso");
  const { data: vinculo } = await db.from("user_organizations").select("user_id").eq("organization_id", org.id).eq("user_id", userId).maybeSingle();
  if (!vinculo) throw new ErroPonte("Esta pessoa não tem acesso ao atendimento deste escritório.", 403, "sem_acesso");
  return { token_hash: hashed, org_status: org.status };
}
