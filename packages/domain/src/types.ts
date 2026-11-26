export type MetodoCalculo = "SIMPLES" | "PONDERADA";

export type CasasDecimais = 0 | 1 | 2;

export type SituacaoDisciplina =
  | "CONFIGURACAO_INCOMPLETA"
  | "SEM_NOTAS"
  | "EM_ANDAMENTO"
  | "EM_RISCO"
  | "APROVACAO_GARANTIDA"
  | "REPROVACAO_INEVITAVEL"
  | "AGUARDANDO_SUBSTITUTIVA"
  | "EM_EXAME_FINAL"
  | "APROVADO"
  | "APROVADO_POS_EXAME"
  | "REPROVADO"
  | "REPROVADO_POS_EXAME";

export type StatusNotaNecessaria =
  | "NECESSARIA"
  | "JA_ATINGIDO"
  | "INVIAVEL"
  | "NAO_APLICAVEL";

export interface AvaliacaoInput {
  id: string;
  nome: string;
  peso: number | string;
  nota: number | string | null;
  elegivelSubstitutiva?: boolean;
}

export interface DisciplinaCalculoInput {
  metodoCalculo: MetodoCalculo;
  notaMinimaAprovacao: number | string;
  casasDecimais: CasasDecimais;
  permiteSubstitutiva: boolean;
  notaSubstitutiva: number | string | null;
  permiteExameFinal: boolean;
  notaMinimaExame: number | string;
  mediaAprovacaoExame: number | string;
  notaExame: number | string | null;
  avaliacoes: AvaliacaoInput[];
}

export interface SubstitutivaResultado {
  permitida: boolean;
  nota: number | null;
  avaliacaoSubstituidaId: string | null;
  ganhoMedia: string;
  notaNecessariaParaAprovar: number | null;
  avaliacaoAlvoSubstitutivaId: string | null;
}

export interface ExameFinalResultado {
  permitido: boolean;
  elegivel: boolean;
  notaMinimaExame: number;
  mediaAprovacaoExame: number;
  notaExame: number | null;
  notaNecessariaExame: number | null;
  mediaPosExame: number | null;
  mediaPosExameExata: string | null;
}

export interface NotaNecessariaResultado {
  status: StatusNotaNecessaria;
  valor: number | null;
  valorExato: string | null;
  maximoAtingivel: number | null;
}

export interface Desempenho {
  configuracaoCompleta: boolean;
  somaPesos: number;
  pesoLancado: number;
  pesoPendente: number;
  pontosAcumulados: number | null;
  pontosAcumuladosExata: string | null;
  mediaParcial: number | null;
  mediaParcialExata: string | null;
  mediaRegular: number | null;
  mediaRegularExata: string | null;
  substitutiva: SubstitutivaResultado;
  exameFinal: ExameFinalResultado;
  mediaFinal: number | null;
  mediaFinalExata: string | null;
  notaMinimaAprovacao: number;
  notaNecessaria: NotaNecessariaResultado;
  situacao: SituacaoDisciplina;
  alertaSubstitutivaDisponivel: boolean;
}

export interface NotaHipoteticaInput {
  avaliacaoId: string;
  nota: number | string | null;
}
