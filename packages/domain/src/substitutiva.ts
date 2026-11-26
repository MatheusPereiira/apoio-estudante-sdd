import Decimal from "decimal.js";
import { CEM, DEZ, ZERO, decimalToNumber, formatExact4, roundCeiling } from "./decimal.js";
import type { AvaliacaoNormalizada } from "./strategies.js";
import type { CasasDecimais, MetodoCalculo, SubstitutivaResultado } from "./types.js";

export interface SubstitutivaCalculoInterno {
  resultado: SubstitutivaResultado;
  mediaRegularComSubExata: Decimal;
  maximaMediaComSubDezExata: Decimal;
}

/**
 * RN19 (Prova Substitutiva):
 * Substitui a avaliação elegível cujo reemplazo maximiza o ganho ponderado
 * +(notaSub - nota_i) * peso_i / 100. Se o ganho <= 0, mantém a nota original.
 */
export function aplicarSubstitutiva(params: {
  metodo: MetodoCalculo;
  avaliacoes: AvaliacaoNormalizada[];
  mediaSemSubExata: Decimal;
  notaMinimaAprovacao: Decimal;
  casasDecimais: CasasDecimais;
  permiteSubstitutiva: boolean;
  notaSubstitutiva: Decimal | null;
  todasRegularesLancadas: boolean;
}): SubstitutivaCalculoInterno {
  const {
    metodo,
    avaliacoes,
    mediaSemSubExata,
    notaMinimaAprovacao,
    casasDecimais,
    permiteSubstitutiva,
    notaSubstitutiva,
    todasRegularesLancadas,
  } = params;

  const n = avaliacoes.length;
  const elegiveis = avaliacoes.filter((a) => a.elegivelSubstitutiva && a.nota !== null);

  const fatorPeso = (av: AvaliacaoNormalizada): Decimal =>
    metodo === "SIMPLES" ? new Decimal(1).div(n) : av.pesoEfetivo.div(CEM);

  let avaliacaoSubstituidaId: string | null = null;
  let ganhoMedia = ZERO;

  if (permiteSubstitutiva && todasRegularesLancadas && notaSubstitutiva !== null) {
    for (const av of elegiveis) {
      if (av.nota === null) continue;
      const ganho = notaSubstitutiva.minus(av.nota).times(fatorPeso(av));
      if (ganho.greaterThan(ganhoMedia)) {
        ganhoMedia = ganho;
        avaliacaoSubstituidaId = av.id;
      }
    }
  }

  const mediaRegularComSubExata = mediaSemSubExata.plus(ganhoMedia);

  // Calcula máxima média possível caso a substitutiva seja 10 (quando ainda pendente)
  let maiorGanhoComDez = ZERO;
  if (permiteSubstitutiva && notaSubstitutiva === null && todasRegularesLancadas) {
    for (const av of elegiveis) {
      if (av.nota === null) continue;
      const ganho = DEZ.minus(av.nota).times(fatorPeso(av));
      if (ganho.greaterThan(maiorGanhoComDez)) {
        maiorGanhoComDez = ganho;
      }
    }
  }
  const maximaMediaComSubDezExata =
    notaSubstitutiva !== null ? mediaRegularComSubExata : mediaSemSubExata.plus(maiorGanhoComDez);

  // CA12.6: Nota necessária na substitutiva para atingir a aprovação direta
  let notaNecessariaParaAprovar: number | null = null;
  let avaliacaoAlvoSubstitutivaId: string | null = null;

  if (
    permiteSubstitutiva &&
    todasRegularesLancadas &&
    notaSubstitutiva === null &&
    mediaSemSubExata.lessThan(notaMinimaAprovacao)
  ) {
    const deficit = notaMinimaAprovacao.minus(mediaSemSubExata);
    let menorNotaNecessaria: Decimal | null = null;

    for (const av of elegiveis) {
      if (av.nota === null) continue;
      const fator = fatorPeso(av);
      if (fator.isZero()) continue;
      const necessaria = av.nota.plus(deficit.div(fator));
      if (necessaria.lessThanOrEqualTo(DEZ)) {
        if (menorNotaNecessaria === null || necessaria.lessThan(menorNotaNecessaria)) {
          menorNotaNecessaria = necessaria;
          avaliacaoAlvoSubstitutivaId = av.id;
        }
      }
    }

    if (menorNotaNecessaria !== null) {
      const clamped = menorNotaNecessaria.lessThan(ZERO) ? ZERO : menorNotaNecessaria;
      notaNecessariaParaAprovar = decimalToNumber(roundCeiling(clamped, casasDecimais));
    }
  }

  return {
    resultado: {
      permitida: permiteSubstitutiva,
      nota: notaSubstitutiva === null ? null : decimalToNumber(notaSubstitutiva),
      avaliacaoSubstituidaId,
      ganhoMedia: formatExact4(ganhoMedia),
      notaNecessariaParaAprovar,
      avaliacaoAlvoSubstitutivaId,
    },
    mediaRegularComSubExata,
    maximaMediaComSubDezExata,
  };
}
