"use client";

import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CampoDeData } from "@/components/ui/campo-de-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuditQuery, type AuditEntry, type AuditFilters } from "@/hooks/audit/useAuditQuery";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { useTeamMembers } from "@/hooks/team/useTeamMembers";
import { AREAS_DA_AUDITORIA, descreverAcao, descreverAtor, detalhesDaMetadata } from "@/lib/audit/legivel";
import { rotuloDoMembro } from "@/lib/users/rotulo-do-atendente";

const TODOS = "__todos__";

/** As áreas que aparecem no filtro (sem repetir "Agente de IA"). */
const AREAS_DO_FILTRO = AREAS_DA_AUDITORIA.filter((a, i, todas) => todas.findIndex((b) => b.rotulo === a.rotulo) === i);

function fmtDate(iso: string, idioma: string): string {
  try {
    return new Date(iso).toLocaleString(idioma, { hour12: false, dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

const rotuloDeCampo = "mb-1 block text-xs text-muted-foreground";

export function AuditClient() {
  const tagDoIdioma = useTagDeIdioma();
  const t = useT();
  const [area, setArea] = useState(TODOS);
  const [quem, setQuem] = useState(TODOS);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);

  const equipe = useTeamMembers();
  const nomes = useMemo(() => {
    const m = new Map<string, string>();
    for (const membro of equipe.data?.data ?? []) m.set(membro.user_id, rotuloDoMembro(membro, t));
    return m;
  }, [equipe.data, t]);

  const filters = useMemo<AuditFilters>(
    () => ({
      // A área filtra pelo prefixo da ação (a rota casa por "contém"). Os dois prefixos de IA (`ai_agent`, `ai`) ficam num só item.
      action: area === TODOS ? undefined : area,
      actor_id: quem === TODOS ? undefined : quem,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
    }),
    [area, quem, from, to],
  );

  const q = useAuditQuery(filters);
  const rows = useMemo(() => q.data?.pages.flatMap((p) => p.data) ?? [], [q.data]);

  function handleExport() {
    const qs = new URLSearchParams();
    if (filters.action) qs.set("action", filters.action);
    if (filters.actor_id) qs.set("actor_id", filters.actor_id);
    if (filters.from) qs.set("from", filters.from);
    if (filters.to) qs.set("to", filters.to);
    window.location.href = `/api/v1/audit/export?${qs.toString()}`;
  }

  const filtrado = area !== TODOS || quem !== TODOS || from !== "" || to !== "";

  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div>
            <label className={rotuloDeCampo}>{t("O que aconteceu")}</label>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger className="w-full bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>{t("Tudo")}</SelectItem>
                {AREAS_DO_FILTRO.map((a) => (
                  <SelectItem key={a.prefixo} value={a.prefixo}>
                    {a.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={rotuloDeCampo}>{t("Quem fez")}</label>
            <Select value={quem} onValueChange={setQuem}>
              <SelectTrigger className="w-full bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>{t("Qualquer pessoa")}</SelectItem>
                {(equipe.data?.data ?? []).map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {rotuloDoMembro(m, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={rotuloDeCampo}>{t("De")}</label>
            <CampoDeData type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className={rotuloDeCampo}>{t("Até")}</label>
            <CampoDeData type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full gap-2 bg-card" onClick={handleExport}>
              <Download className="size-4" aria-hidden />
              {t("Exportar planilha")}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>{t("Quando")}</TableHead>
              <TableHead>{t("Quem")}</TableHead>
              <TableHead>{t("O que aconteceu")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  {filtrado ? t("Nada registrado com esses filtros. Tente outro período ou outra pessoa.") : t("Ainda não há nada registrado.")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => <Linha key={r.id} r={r} nomes={nomes} aberta={aberta === r.id} alternar={() => setAberta(aberta === r.id ? null : r.id)} tag={tagDoIdioma} />)
            )}
          </TableBody>
        </Table>
      </Card>

      {q.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" className="bg-card" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
            {q.isFetchingNextPage ? t("Carregando…") : t("Carregar mais")}
          </Button>
        </div>
      )}
    </div>
  );
}

function Linha({ r, nomes, aberta, alternar, tag }: { r: AuditEntry; nomes: ReadonlyMap<string, string>; aberta: boolean; alternar: () => void; tag: string }) {
  const t = useT();
  const ator = descreverAtor(r, nomes);
  const detalhes = detalhesDaMetadata(r.metadata);
  return (
    <Fragment>
      <TableRow className="cursor-pointer" onClick={alternar} aria-expanded={aberta}>
        <TableCell className="w-8 text-muted-foreground">{aberta ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}</TableCell>
        <TableCell className="whitespace-nowrap text-sm">{fmtDate(r.created_at, tag)}</TableCell>
        <TableCell className="text-sm">{ator.tipo === "pessoa" || ator.tipo === "plataforma" ? ator.nome : <span className="text-muted-foreground">{ator.nome}</span>}</TableCell>
        <TableCell className="text-sm font-medium">{descreverAcao(r.action)}</TableCell>
      </TableRow>
      {aberta ? (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell />
          <TableCell colSpan={3} className="py-3">
            {detalhes.length > 0 ? (
              <dl className="mb-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm md:grid-cols-2">
                {detalhes.map((d) => (
                  <div key={d.chave} className="flex gap-2">
                    <dt className="shrink-0 text-muted-foreground">{d.chave}:</dt>
                    <dd className="break-all">{d.valor}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mb-3 text-sm text-muted-foreground">{t("Sem detalhes adicionais para este registro.")}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {t("Dados técnicos")}: {r.action}
              {r.resource_type ? ` · ${r.resource_type}${r.resource_id ? ` ${r.resource_id.slice(0, 8)}` : ""}` : ""}
              {r.request_id ? ` · ${t("pedido")} ${r.request_id.slice(0, 8)}` : ""}
              {r.actor_ip ? ` · IP ${r.actor_ip}` : ""}
            </p>
          </TableCell>
        </TableRow>
      ) : null}
    </Fragment>
  );
}
