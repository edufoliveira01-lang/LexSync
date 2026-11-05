import { createClient } from "@supabase/supabase-js";
import { criarServidor } from "./servidor.js";

const env = (n: string) => { const v = process.env[n]?.trim(); if (!v) { console.error(`[ponte] Falta a variável ${n}.`); process.exit(1); } return v; };
const segredo = env("SALES_BRIDGE_SECRET");
if (segredo.length < 32) { console.error("[ponte] SALES_BRIDGE_SECRET precisa ter pelo menos 32 caracteres."); process.exit(1); }
const atorId = env("SALES_ACTOR_ID");
if (!/^[0-9a-f-]{36}$/i.test(atorId)) { console.error("[ponte] SALES_ACTOR_ID deve ser o UUID de um administrador da plataforma (escopo full)."); process.exit(1); }
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
const porta = Number(process.env.PORT || 3900);
criarServidor(db, { segredo, atorId, urlPublica: env("DESKCOMM_PUBLIC_URL") }).listen(porta, "0.0.0.0", () => console.log(`[ponte] ouvindo na porta ${porta}`));
