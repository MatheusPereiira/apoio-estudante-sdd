import Decimal from "decimal.js";
import {
  CEM,
  DEZ,
  ZERO,
  decimalToNumber,
  formatExact4,
  roundCeiling,
  roundHalfUp,
} from "./decimal.js";
import type { AvaliacaoNormalizada, CalculoStrategy } from "./strategies.js";
import type { CasasDecimais, NotaNecessariaResultado } from "./types.js";

/**
 * RN10 (Nota Necessária nas avaliações pendentes):
 * Calcula a nota uniforme conservadora (CEILING) para atingir `alvo`.
 */
export function calcularNotaNecessariaPendentes(params: {
  configuracaoCompleta: boolean;
  strategy: CalculoStrategy;
  avaliacoes: AvaliacaoNormalizada[];
  lancadas: AvaliacaoNormalizada[];
  pendentes: AvaliacaoNormalizada[];
  pontosAcumuladosExato: Decimal;
  alvo: Decimal;
  casasDecimais: CasasDecimais;
  mediaFinalAtual: Decimal | null;
}): NotaNecessariaResultado {
  const {
    configuracaoCompleta,
    strategy,
    avaliacoes,
    lancadas,
    pendentes,
    pontosAcumuladosExato,
    alvo,
    casasDecimais,
    mediaFinalAtual,
  } = params;

  if (!configuracaoCompleta) {
    return {
      status: "NAO_APLICAVEL",
      valor: null,
      valorExato: null,
      maximoAtingivel: null,
    };
  }

  if (pendentes.length === 0) {
    return {
      status: "NAO_APLICAVEL",
      valor: null,
      valorExato: null,
      maximoAtingivel:
        mediaFinalAtual === null
          ? null
          : decimalToNumber(roundHalfUp(mediaFinalAtual, casasDecimais)),
    };
  }

  const pesoPendente = pendentes.reduce((acc, a) => acc.plus(a.pesoEfetivo), ZERO);
  const ganhoMaximoPendentes =
    strategy.metodo === "SIMPLES"
      ? DEZ.times(pendentes.length).div(avaliacoes.length)
      : DEZ.times(pesoPendente).div(CEM);

  const maximoAtingivelExato = pontosAcumuladosExato.plus(ganhoMaximoPendentes);
  const maximoAtingivel = decimalToNumber(roundHalfUp(maximoAtingivelExato, casasDecimais));

  const xExato = strategy.calcularNotaNecessaria(alvo, lancadas, pendentes, avaliacoes.length);

  if (xExato.lessThanOrEqualTo(ZERO)) {
    return {
      status: "JA_ATINGIDO",
      valor: null,
      valorExato: null,
      maximoAtingivel,
    };
  }

  const valorArredondado = roundCeiling(xExato, casasDecimais);

  if (xExato.greaterThan(DEZ)) {
    return {
      status: "INVIAVEL",
      valor: decimalToNumber(valorArredondado),
      valorExato: formatExact4(xExato),
      maximoAtingivel,
    };
  }

  return {
    status: "NECESSARIA",
    valor: decimalToNumber(valorArredondado),
    valorExato: formatExact4(xExato),
    maximoAtingivel,
  };
}
