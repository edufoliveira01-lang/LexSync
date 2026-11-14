"use client";

import type { NodeProps } from "@xyflow/react";

import type { RFNode } from "@/lib/followup/graph-mappers";
import { useT } from "@/hooks/i18n/useT";
import { NODE_VISUALS, describeNodeConfig } from "./nodeVisuals";
import { NodeCard } from "./NodeCard";

/** O nó `internal_note` no canvas: anota na conversa do cliente (só a equipe lê). */
export function InternalNoteNode({ id, data, selected }: NodeProps<RFNode>) {
  const t = useT();
  return (
    <NodeCard
      id={id}
      visual={NODE_VISUALS.internal_note}
      label={data.label}
      subtitle={describeNodeConfig("internal_note", data.config, t)}
      selected={selected}
      errors={data.errors}
    />
  );
}
