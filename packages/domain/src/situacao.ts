import Decimal from "decimal.js";
import { CEM, DEZ, ZERO, roundHalfUp } from "./decimal.js";
import type { AvaliacaoNormalizada } from "./strategies.js";
import type {
  CasasDecimais,
  MetodoCalculo,
  NotaNecessariaResultado,
  SituacaoDisciplina,
} from "./types.js";

/**
 * RF15 — Classificação determinística nos 12 estados de situação da disciplina.
 * Regras avaliadas estritamente na ordem da especificação (valores comparados após arredondamento de exibição).
 */
export function classificarSituacao(params: {
  configuracaoCompleta: boolean;
  totalLancadas: number;
  totalPendentes: number;
  metodoCalculo: MetodoCalculo;
  avaliacoes: AvaliacaoNormalizada[];
  casasDecimais: CasasDecimais;
  notaMinimaAprovacao: Decimal;
  permiteSubstitutiva: boolean;
  notaSubstitutiva: Decimal | null;
  permiteExameFinal: boolean;
  notaMinimaExame: Decimal;
  mediaAprovacaoExame: Decimal;
  notaExame: Decimal | null;
  pontosAcumuladosExibido: Decimal | null;
  mediaParcialExibida: Decimal | null;
  mediaRegularExibida: Decimal | null;
  maximaMediaComSubDezExata: Decimal | null;
  mediaPosExameExibida: Decimal | null;
  notaNecessaria: NotaNecessariaResultado;
}): SituacaoDisciplina {
  const {
    configuracaoCompleta,
    totalLancadas,
    totalPendentes,
    metodoCalculo,
    avaliacoes,
    casasDecimais,
    notaMinimaAprovacao,
    permiteSubstitutiva,
    notaSubstitutiva,
    permiteExameFinal,
    notaMinimaExame,
    mediaAprovacaoExame,
    notaExame,
    pontosAcumuladosExibido,
    mediaParcialExibida,
    mediaRegularExibida,
    maximaMediaComSubDezExata,
    mediaPosExameExibida,
    notaNecessaria,
  } = params;

  // 1. CONFIGURACAO_INCOMPLETA
  if (!configuracaoCompleta) {
    return "CONFIGURACAO_INCOMPLETA";
  }

  // 2. SEM_NOTAS
  if (totalLancadas === 0) {
    return "SEM_NOTAS";
  }

  const limiarSobrevivencia = permiteExameFinal ? notaMinimaExame : notaMinimaAprovacao;

  // 3..8: Todas as avaliações regulares lançadas
  if (totalPendentes === 0 && mediaRegularExibida !== null) {
    // 3. APROVADO
    if (mediaRegularExibida.greaterThanOrEqualTo(notaMinimaAprovacao)) {
      return "APROVADO";
    }

    // 4 & 5. Pós-Exame Final
    if (
      permiteExameFinal &&
      mediaRegularExibida.greaterThanOrEqualTo(notaMinimaExame) &&
      notaExame !== null &&
      mediaPosExameExibida !== null
    ) {
      return mediaPosExameExibida.greaterThanOrEqualTo(mediaAprovacaoExame)
        ? "APROVADO_POS_EXAME"
        : "REPROVADO_POS_EXAME";
    }

    // 6. EM_EXAME_FINAL
    if (
      permiteExameFinal &&
      mediaRegularExibida.greaterThanOrEqualTo(notaMinimaExame) &&
      notaExame === null
    ) {
      return "EM_EXAME_FINAL";
    }

    // 8. AGUARDANDO_SUBSTITUTIVA (verificada antes de REPROVADO definitivo)
    if (
      permiteSubstitutiva &&
      notaSubstitutiva === null &&
      maximaMediaComSubDezExata !== null
    ) {
      const maxExibido = roundHalfUp(maximaMediaComSubDezExata, casasDecimais);
      if (maxExibido.greaterThanOrEqualTo(limiarSobrevivencia)) {
        return "AGUARDANDO_SUBSTITUTIVA";
      }
    }

    // 7. REPROVADO
    return "REPROVADO";
  }

  // 9..12: Ainda existem avaliações pendentes
  // 9. APROVACAO_GARANTIDA
  if (
    pontosAcumuladosExibido !== null &&
    pontosAcumuladosExibido.greaterThanOrEqualTo(notaMinimaAprovacao)
  ) {
    return "APROVACAO_GARANTIDA";
  }

  // 10. REPROVACAO_INEVITAVEL
  // Calcula o teto absoluto assumindo 10 em todas as pendentes + eventual substitutiva = 10
  const n = avaliacoes.length;
  const fatorPeso = (av: AvaliacaoNormalizada): Decimal =>
    metodoCalculo === "SIMPLES" ? new Decimal(1).div(n) : av.pesoEfetivo.div(CEM);

  let maxMediaComPendentesDez = ZERO;
  let maiorGanhoSubPendentes = ZERO;

  for (const av of avaliacoes) {
    const notaHipotetica = av.nota === null ? DEZ : av.nota;
    const fator = fatorPeso(av);
    maxMediaComPendentesDez = maxMediaComPendentesDez.plus(notaHipotetica.times(fator));

    if (permiteSubstitutiva && notaSubstitutiva === null && av.elegivelSubstitutiva && av.nota !== null) {
      const ganho = DEZ.minus(av.nota).times(fator);
      if (ganho.greaterThan(maiorGanhoSubPendentes)) {
        maiorGanhoSubPendentes = ganho;
      }
    }
  }

  const maxAbsolutoExibido = roundHalfUp(
    maxMediaComPendentesDez.plus(maiorGanhoSubPendentes),
    casasDecimais
  );

  if (maxAbsolutoExibido.lessThan(limiarSobrevivencia)) {
    return "REPROVACAO_INEVITAVEL";
  }

  // 11. EM_RISCO
  if (notaNecessaria.status === "INVIAVEL") {
    return "EM_RISCO";
  }
  if (
    notaNecessaria.status === "NECESSARIA" &&
    notaNecessaria.valor !== null &&
    mediaParcialExibida !== null &&
    new Decimal(String(notaNecessaria.valor)).greaterThan(mediaParcialExibida)
  ) {
    return "EM_RISCO";
  }

  // 12. EM_ANDAMENTO
  return "EM_ANDAMENTO";
}

/**
 * Prioridade de ordenação no painel do período (RF14 / CA14.1 / CT03 / ui-ux-spec.md §3).
 */
export function prioridadePainel(situacao: SituacaoDisciplina): number {
  switch (situacao) {
    case "REPROVACAO_INEVITAVEL":
      return 1;
    case "AGUARDANDO_SUBSTITUTIVA":
      return 1;
    case "EM_EXAME_FINAL":
      return 2;
    case "EM_RISCO":
      return 2;
    case "CONFIGURACAO_INCOMPLETA":
      return 3;
    case "EM_ANDAMENTO":
      return 4;
    case "SEM_NOTAS":
      return 4;
    case "APROVACAO_GARANTIDA":
      return 5;
    case "APROVADO":
      return 5;
    case "APROVADO_POS_EXAME":
      return 5;
    case "REPROVADO":
    case "REPROVADO_POS_EXAME":
      return 6;
  }
}

export function subOrdemPainel(situacao: SituacaoDisciplina): number {
  const ordem: Record<SituacaoDisciplina, number> = {
    REPROVACAO_INEVITAVEL: 1,
    AGUARDANDO_SUBSTITUTIVA: 2,
    EM_EXAME_FINAL: 3,
    EM_RISCO: 4,
    CONFIGURACAO_INCOMPLETA: 5,
    EM_ANDAMENTO: 6,
    SEM_NOTAS: 7,
    APROVACAO_GARANTIDA: 8,
    APROVADO: 9,
    APROVADO_POS_EXAME: 10,
    REPROVADO: 11,
    REPROVADO_POS_EXAME: 12,
  };
  return ordem[situacao];
}
