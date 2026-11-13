import { notFound } from "next/navigation";

import { ContactsListClient } from "@/app/app/contacts/_client";
import { FunisTela } from "@/app/app/kanban/_components/FunisTela";
import { ContactDetailClient } from "@/app/app/contacts/[id]/_client";
import { AgendaClient } from "@/app/app/agenda/_client";
import { PipelinePageClient } from "@/app/app/pipelines/[id]/_client";
import { RespostasRapidasTela } from "@/app/app/templates/_components/RespostasRapidasTela";
import { RadarTela } from "@/app/app/radar/_components/RadarTela";

/** Telas disponíveis no preview. Cada uma é o componente REAL da tela; os dados vêm do mock de rede. */
const FUNIS = [
  { id: "f1", name: "Captação", slug: "captacao", description: "Quem chegou agora e ainda não foi atendido.", position: 0, is_default: true, is_client_pipeline: false },
  { id: "f2", name: "Previdenciário", slug: "previdenciario", description: "Benefícios por incapacidade, BPC e aposentadorias.", position: 1, is_default: false, is_client_pipeline: false },
  { id: "f3", name: "Clientes", slug: "clientes", description: "Quem já assinou contrato.", position: 2, is_default: false, is_client_pipeline: true },
] as never[];
const ETAPAS = {
  f1: [{ id: "e1", name: "Novo", is_won: false, is_lost: false }, { id: "e2", name: "Qualificado", is_won: false, is_lost: false }, { id: "e3", name: "Contrato enviado", is_won: false, is_lost: false }, { id: "e4", name: "Assinado", is_won: true, is_lost: false }],
  f2: [{ id: "e5", name: "Triagem", is_won: false, is_lost: false }, { id: "e6", name: "Documentos", is_won: false, is_lost: false }, { id: "e7", name: "Ganho", is_won: true, is_lost: false }],
  f3: [{ id: "e8", name: "Ativo", is_won: false, is_lost: false }],
};

const AGORA = new Date();
const dia = (d: number, h: number, m = 0) => { const x = new Date(AGORA); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x.toISOString(); };
const AGENDAMENTOS = [
  { id: "a1", titulo: "Consulta — Maria da Silva", quemSeraAtendido: "Maria da Silva", responsavelId: "u1", comeca: dia(0, 9), termina: dia(0, 10), tipo: "Consulta inicial", origem: "mcp", situacao: "confirmed" },
  { id: "a2", titulo: "Retorno — João Pereira", quemSeraAtendido: "João Pereira", responsavelId: "u1", comeca: dia(0, 14), termina: dia(0, 15), tipo: "Retorno", origem: "ui", situacao: "pending" },
  { id: "a3", titulo: "Perícia — Ana Costa", quemSeraAtendido: "Ana Costa", responsavelId: "u1", comeca: dia(1, 10, 30), termina: dia(1, 11, 30), tipo: "Perícia", origem: "google_sync", situacao: "confirmed" },
] as never[];

const TELAS: Record<string, () => React.ReactNode> = {
  contacts: () => <ContactsListClient />,
  radar: () => <RadarTela />,
  templates: () => <RespostasRapidasTela canShare currentUserId="00000000-0000-4000-8000-000000000001" />,
  quadro: () => (
    <PipelinePageClient
      pipelineId="f1"
      initialName="Captação"
      role="admin"
      funis={[{ id: "f1", name: "Captação" }, { id: "f2", name: "Previdenciário" }]}
      funilInicial={{ id: "f1", name: "Captação", slug: "captacao", description: null, position: 0, is_default: true, is_client_pipeline: false, is_archived: false, settings: {} } as never}
      etapasIniciais={[
        { id: "e1", pipeline_id: "f1", name: "Novo", position: 0, is_won: false, is_lost: false, is_archived: false, color: null },
        { id: "e2", pipeline_id: "f1", name: "Qualificado", position: 1, is_won: false, is_lost: false, is_archived: false, color: null },
        { id: "e3", pipeline_id: "f1", name: "Contrato enviado", position: 2, is_won: false, is_lost: false, is_archived: false, color: null },
        { id: "e4", pipeline_id: "f1", name: "Assinado", position: 3, is_won: true, is_lost: false, is_archived: false, color: null },
      ] as never}
    />
  ),
  agenda: () => (
    <AgendaClient
      fusoDaAgenda="America/Sao_Paulo"
      fusoDeApresentacao={null}
      hojeNaOrganizacao={AGORA.toISOString().slice(0, 10)}
      usuarioId="u1"
      googleConfigurado={false}
      faltaNoGoogle={[]}
      tiposIniciais={[{ id: "t1", nome: "Consulta inicial", duracaoMin: 60, donoId: "u1", localKind: "online", localDetalhes: null }]}
      agendamentosIniciais={AGENDAMENTOS}
      podeMarcar
    />
  ),
  contato: () => <ContactDetailClient contactId="c0000000-0000-4000-8000-000000000001" />,
  kanban: () => <FunisTela funis={FUNIS} arquivados={[]} podeGerenciar podeImportar etapas={ETAPAS} />,
};

export default async function DevPreviewPage({ params }: { params: Promise<{ tela: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { tela } = await params;
  const montar = TELAS[tela];
  if (!montar) notFound();
  return montar();
}
