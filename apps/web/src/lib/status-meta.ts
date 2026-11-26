import type { SituacaoDisciplina } from "@app/domain";

export interface SituacaoMeta {
  label: string;
  badgeClass: string;
  iconName:
    | "alert-octagon"
    | "rotate-ccw"
    | "flag"
    | "alert-triangle"
    | "settings"
    | "circle-dot"
    | "circle"
    | "check-circle"
    | "award"
    | "x-circle";
}

/**
 * Tokens visuais acessíveis WCAG 2.1 AA para os 12 estados de situação (docs/ui-ux-spec.md §3).
 * Sempre combina cor + ícone SVG + rótulo textual (CA14.2 / RNF16).
 */
export const SITUACAO_META: Record<SituacaoDisciplina, SituacaoMeta> = {
  REPROVACAO_INEVITAVEL: {
    label: "Reprovação inevitável",
    badgeClass: "bg-red-100 text-red-900 border-red-400",
    iconName: "alert-octagon",
  },
  AGUARDANDO_SUBSTITUTIVA: {
    label: "Precisa de Substitutiva",
    badgeClass: "bg-purple-100 text-purple-900 border-purple-400",
    iconName: "rotate-ccw",
  },
  EM_EXAME_FINAL: {
    label: "Em Exame Final",
    badgeClass: "bg-orange-100 text-orange-900 border-orange-400",
    iconName: "flag",
  },
  EM_RISCO: {
    label: "Atenção / Em risco",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-400",
    iconName: "alert-triangle",
  },
  CONFIGURACAO_INCOMPLETA: {
    label: "Pesos incompletos",
    badgeClass: "bg-slate-100 text-slate-800 border-dashed border-slate-400",
    iconName: "settings",
  },
  EM_ANDAMENTO: {
    label: "Em andamento",
    badgeClass: "bg-blue-100 text-blue-900 border-blue-300",
    iconName: "circle-dot",
  },
  SEM_NOTAS: {
    label: "Sem notas lançadas",
    badgeClass: "bg-gray-100 text-gray-800 border-gray-300",
    iconName: "circle",
  },
  APROVACAO_GARANTIDA: {
    label: "Aprovação garantida",
    badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-400",
    iconName: "check-circle",
  },
  APROVADO: {
    label: "Aprovado",
    badgeClass: "bg-green-100 text-green-900 border-green-500",
    iconName: "award",
  },
  APROVADO_POS_EXAME: {
    label: "Aprovado no Exame",
    badgeClass: "bg-teal-100 text-teal-900 border-teal-500",
    iconName: "award",
  },
  REPROVADO: {
    label: "Reprovado",
    badgeClass: "bg-rose-100 text-rose-900 border-rose-400",
    iconName: "x-circle",
  },
  REPROVADO_POS_EXAME: {
    label: "Reprovado no Exame",
    badgeClass: "bg-rose-100 text-rose-900 border-rose-400",
    iconName: "x-circle",
  },
};
