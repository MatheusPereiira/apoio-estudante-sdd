import Decimal from "decimal.js";
import {
  CEM,
  ZERO,
  decimalToNumber,
  formatExact4,
  roundHalfUp,
  toDecimal,
} from "./decimal.js";
import { calcularExameFinal } from "./exame.js";
import { calcularNotaNecessariaPendentes } from "./nota-necessaria.js";
import { classificarSituacao } from "./situacao.js";
import { obterStrategy } from "./strategies.js";
import { aplicarSubstitutiva } from "./substitutiva.js";
import type {
  Desempenho,
  DisciplinaCalculoInput,
  NotaHipoteticaInput,
  NotaNecessariaResultado,
} from "./types.js";

/**
 * Facade pura do motor de cálculo @app/domain (RN04–RN10, RN19–RN21).
 * 100% determinística, sem I/O, usando exclusivamente aritmética decimal exata.
 */
export function calcularDesempenho(
  input: DisciplinaCalculoInput,
  alvoOpcional?: number | string
): Desempenho {
  const strategy = obterStrategy(input.metodoCalculo);
  const avaliacoes = strategy.normalizarAvaliacoes(input.avaliacoes);

  const notaMinimaAprovacao = toDecimal(input.notaMinimaAprovacao);
  const notaMinimaExame = toDecimal(input.notaMinimaExame);
  const mediaAprovacaoExame = toDecimal(input.mediaAprovacaoExame);
  const notaSubstitutiva =
    input.notaSubstitutiva === null ? null : toDecimal(input.notaSubstitutiva);
  const notaExame = input.notaExame === null ? null : toDecimal(input.notaExame);
  const alvo = alvoOpcional !== undefined ? toDecimal(alvoOpcional) : notaMinimaAprovacao;

  const somaPesosInformados = avaliacoes.reduce((acc, a) => acc.plus(a.pesoInformado), ZERO);
  const somaPesosEfetivos =
    input.metodoCalculo === "SIMPLES"
      ? avaliacoes.length > 0
        ? CEM
        : ZERO
      : somaPesosInformados;

  const configuracaoCompleta = strategy.configuracaoCompleta(avaliacoes, somaPesosInformados);

  const lancadas = avaliacoes.filter((a) => a.nota !== null);
  const pendentes = avaliacoes.filter((a) => a.nota === null);
  const todasRegularesLancadas = configuracaoCompleta && pendentes.length === 0 && lancadas.length > 0;

  const pesoLancado = lancadas.reduce((acc, a) => acc.plus(a.pesoEfetivo), ZERO);
  const pesoPendente = pendentes.reduce((acc, a) => acc.plus(a.pesoEfetivo), ZERO);

  if (!configuracaoCompleta) {
    const exame = calcularExameFinal({
      permiteExameFinal: input.permiteExameFinal,
      notaMinimaAprovacao,
      notaMinimaExame,
      mediaAprovacaoExame,
      casasDecimais: input.casasDecimais,
      todasRegularesLancadas: false,
      mediaRegularExata: null,
      mediaRegularExibida: null,
      notaExame: null,
    });

    return {
      configuracaoCompleta: false,
      somaPesos: decimalToNumber(roundHalfUp(somaPesosEfetivos, 2)),
      pesoLancado: decimalToNumber(roundHalfUp(pesoLancado, 2)),
      pesoPendente: decimalToNumber(roundHalfUp(pesoPendente, 2)),
      pontosAcumulados: null,
      pontosAcumuladosExata: null,
      mediaParcial: null,
      mediaParcialExata: null,
      mediaRegular: null,
      mediaRegularExata: null,
      substitutiva: {
        permitida: input.permiteSubstitutiva,
        nota: notaSubstitutiva === null ? null : decimalToNumber(notaSubstitutiva),
        avaliacaoSubstituidaId: null,
        ganhoMedia: "0.0000",
        notaNecessariaParaAprovar: null,
        avaliacaoAlvoSubstitutivaId: null,
      },
      exameFinal: exame.resultado,
      mediaFinal: null,
      mediaFinalExata: null,
      notaMinimaAprovacao: decimalToNumber(notaMinimaAprovacao),
      notaNecessaria: {
        status: "NAO_APLICAVEL",
        valor: null,
        valorExato: null,
        maximoAtingivel: null,
      },
      situacao: "CONFIGURACAO_INCOMPLETA",
      alertaSubstitutivaDisponivel: false,
    };
  }

  const pontosAcumuladosExato = strategy.calcularPontosAcumulados(lancadas, avaliacoes.length);
  const pontosAcumuladosExibido =
    lancadas.length > 0 ? roundHalfUp(pontosAcumuladosExato, input.casasDecimais) : null;

  const mediaParcialExata =
    lancadas.length > 0 ? strategy.calcularMediaParcial(lancadas) : null;
  const mediaParcialExibida =
    mediaParcialExata !== null ? roundHalfUp(mediaParcialExata, input.casasDecimais) : null;

  let mediaRegularExata: Decimal | null = null;
  let mediaRegularExibida: Decimal | null = null;
  let maximaMediaComSubDezExata: Decimal | null = null;

  const subCalc = aplicarSubstitutiva({
    metodo: input.metodoCalculo,
    avaliacoes,
    mediaSemSubExata: pontosAcumuladosExato,
    notaMinimaAprovacao,
    casasDecimais: input.casasDecimais,
    permiteSubstitutiva: input.permiteSubstitutiva,
    notaSubstitutiva,
    todasRegularesLancadas,
  });

  if (todasRegularesLancadas) {
    mediaRegularExata = subCalc.mediaRegularComSubExata;
    mediaRegularExibida = roundHalfUp(mediaRegularExata, input.casasDecimais);
    maximaMediaComSubDezExata = subCalc.maximaMediaComSubDezExata;
  }

  const exameCalc = calcularExameFinal({
    permiteExameFinal: input.permiteExameFinal,
    notaMinimaAprovacao,
    notaMinimaExame,
    mediaAprovacaoExame,
    casasDecimais: input.casasDecimais,
    todasRegularesLancadas,
    mediaRegularExata,
    mediaRegularExibida,
    notaExame,
  });

  let mediaFinalExata: Decimal | null = null;
  let mediaFinalExibida: Decimal | null = null;

  if (todasRegularesLancadas) {
    if (exameCalc.mediaPosExameExata !== null && exameCalc.mediaPosExameExibida !== null) {
      mediaFinalExata = exameCalc.mediaPosExameExata;
      mediaFinalExibida = exameCalc.mediaPosExameExibida;
    } else if (mediaRegularExata !== null && mediaRegularExibida !== null) {
      mediaFinalExata = mediaRegularExata;
      mediaFinalExibida = mediaRegularExibida;
    }
  }

  const notaNecessaria: NotaNecessariaResultado = calcularNotaNecessariaPendentes({
    configuracaoCompleta,
    strategy,
    avaliacoes,
    lancadas,
    pendentes,
    pontosAcumuladosExato,
    alvo,
    casasDecimais: input.casasDecimais,
    mediaFinalAtual: mediaFinalExata,
  });

  const situacao = classificarSituacao({
    configuracaoCompleta,
    totalLancadas: lancadas.length,
    totalPendentes: pendentes.length,
    metodoCalculo: input.metodoCalculo,
    avaliacoes,
    casasDecimais: input.casasDecimais,
    notaMinimaAprovacao,
    permiteSubstitutiva: input.permiteSubstitutiva,
    notaSubstitutiva,
    permiteExameFinal: input.permiteExameFinal,
    notaMinimaExame,
    mediaAprovacaoExame,
    notaExame,
    pontosAcumuladosExibido,
    mediaParcialExibida,
    mediaRegularExibida,
    maximaMediaComSubDezExata,
    mediaPosExameExibida: exameCalc.mediaPosExameExibida,
    notaNecessaria,
  });

  const alertaSubstitutivaDisponivel =
    situacao === "EM_EXAME_FINAL" &&
    input.permiteSubstitutiva &&
    notaSubstitutiva === null;

  return {
    configuracaoCompleta: true,
    somaPesos: decimalToNumber(roundHalfUp(somaPesosEfetivos, 2)),
    pesoLancado: decimalToNumber(roundHalfUp(pesoLancado, 2)),
    pesoPendente: decimalToNumber(roundHalfUp(pesoPendente, 2)),
    pontosAcumulados:
      pontosAcumuladosExibido === null ? null : decimalToNumber(pontosAcumuladosExibido),
    pontosAcumuladosExata: lancadas.length > 0 ? formatExact4(pontosAcumuladosExato) : null,
    mediaParcial: mediaParcialExibida === null ? null : decimalToNumber(mediaParcialExibida),
    mediaParcialExata: mediaParcialExata === null ? null : formatExact4(mediaParcialExata),
    mediaRegular: mediaRegularExibida === null ? null : decimalToNumber(mediaRegularExibida),
    mediaRegularExata: mediaRegularExata === null ? null : formatExact4(mediaRegularExata),
    substitutiva: subCalc.resultado,
    exameFinal: exameCalc.resultado,
    mediaFinal: mediaFinalExibida === null ? null : decimalToNumber(mediaFinalExibida),
    mediaFinalExata: mediaFinalExata === null ? null : formatExact4(mediaFinalExata),
    notaMinimaAprovacao: decimalToNumber(notaMinimaAprovacao),
    notaNecessaria,
    situacao,
    alertaSubstitutivaDisponivel,
  };
}

/**
 * RF13 / RN13 — Simulação "e se" (função pura; nunca altera estado persistido).
 */
export function simularDesempenho(
  input: DisciplinaCalculoInput,
  notasHipoteticas: NotaHipoteticaInput[],
  extras?: { notaSubstitutiva?: number | null; notaExame?: number | null }
): { desempenhoAtual: Desempenho; desempenhoSimulado: Desempenho } {
  const mapa = new Map<string, number | string | null>();
  for (const item of notasHipoteticas) {
    mapa.set(item.avaliacaoId, item.nota);
  }

  const avaliacoesSimuladas = input.avaliacoes.map((a) =>
    mapa.has(a.id) ? { ...a, nota: mapa.get(a.id) ?? null } : a
  );

  const inputSimulado: DisciplinaCalculoInput = {
    ...input,
    notaSubstitutiva:
      extras?.notaSubstitutiva !== undefined ? extras.notaSubstitutiva : input.notaSubstitutiva,
    notaExame: extras?.notaExame !== undefined ? extras.notaExame : input.notaExame,
    avaliacoes: avaliacoesSimuladas,
  };

  return {
    desempenhoAtual: calcularDesempenho(input),
    desempenhoSimulado: calcularDesempenho(inputSimulado),
  };
}
