"use client";

import type { SituacaoDisciplina } from "@app/domain";
import {
  AlertOctagon,
  AlertTriangle,
  Award,
  CheckCircle2,
  Circle,
  CircleDot,
  Flag,
  RotateCcw,
  Settings,
  XCircle,
} from "lucide-react";
import { SITUACAO_META } from "@/lib/status-meta";

function renderIcon(name: (typeof SITUACAO_META)[SituacaoDisciplina]["iconName"]) {
  const cls = "h-3.5 w-3.5 shrink-0";
  switch (name) {
    case "alert-octagon":
      return <AlertOctagon className={cls} aria-hidden="true" />;
    case "rotate-ccw":
      return <RotateCcw className={cls} aria-hidden="true" />;
    case "flag":
      return <Flag className={cls} aria-hidden="true" />;
    case "alert-triangle":
      return <AlertTriangle className={cls} aria-hidden="true" />;
    case "settings":
      return <Settings className={cls} aria-hidden="true" />;
    case "circle-dot":
      return <CircleDot className={cls} aria-hidden="true" />;
    case "circle":
      return <Circle className={cls} aria-hidden="true" />;
    case "check-circle":
      return <CheckCircle2 className={cls} aria-hidden="true" />;
    case "award":
      return <Award className={cls} aria-hidden="true" />;
    case "x-circle":
      return <XCircle className={cls} aria-hidden="true" />;
  }
}

export function StatusBadge({ situacao }: { situacao: SituacaoDisciplina }) {
  const meta = SITUACAO_META[situacao];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.badgeClass}`}
      data-testid={`status-badge-${situacao}`}
    >
      {renderIcon(meta.iconName)}
      <span>{meta.label}</span>
    </span>
  );
}
