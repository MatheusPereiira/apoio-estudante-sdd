import Decimal from "decimal.js";
import {
  DOIS,
  ZERO,
  decimalToNumber,
  formatExact4,
  roundCeiling,
  roundHalfUp,
} from "./decimal.js";
import type { CasasDecimais, ExameFinalResultado } from "./types.js";

export interface ExameCalculoInterno {
  resultado: ExameFinalResultado;
  mediaPosExameExata: Decimal | null;
  mediaPosExameExibida: Decimal | null;
}

/**
 * RN20 & RN21 (Exame Final e Média Pós-Exame):
 * Elegível se permiteExameFinal = true, todas regulares lançadas e
 * notaMinimaExame <= mediaRegularExibida < notaMinimaAprovacao.
 */
export function calcularExameFinal(params: {
  permiteExameFinal: boolean;
  notaMinimaAprovacao: Decimal;
  notaMinimaExame: Decimal;
  mediaAprovacaoExame: Decimal;
  casasDecimais: CasasDecimais;
  todasRegularesLancadas: boolean;
  mediaRegularExata: Decimal | null;
  mediaRegularExibida: Decimal | null;
  notaExame: Decimal | null;
}): ExameCalculoInterno {
  const {
    permiteExameFinal,
    notaMinimaAprovacao,
    notaMinimaExame,
    mediaAprovacaoExame,
    casasDecimais,
    todasRegularesLancadas,
    mediaRegularExata,
    mediaRegularExibida,
    notaExame,
  } = params;

  const elegivel =
    permiteExameFinal &&
    todasRegularesLancadas &&
    mediaRegularExibida !== null &&
    mediaRegularExata !== null &&
    mediaRegularExibida.greaterThanOrEqualTo(notaMinimaExame) &&
    mediaRegularExibida.lessThan(notaMinimaAprovacao);

  let notaNecessariaExame: number | null = null;
  let mediaPosExameExata: Decimal | null = null;
  let mediaPosExameExibida: Decimal | null = null;

  if (elegivel && mediaRegularExata !== null) {
    // RN10 / CA12.5: x_exame = (2 * mediaAprovacaoExame) - mediaRegular
    const necessaria = DOIS.times(mediaAprovacaoExame).minus(mediaRegularExata);
    const clamped = necessaria.lessThan(ZERO) ? ZERO : necessaria;
    notaNecessariaExame = decimalToNumber(roundCeiling(clamped, casasDecimais));

    if (notaExame !== null) {
      // RN21: mediaPosExame = (mediaRegular + notaExame) / 2
      mediaPosExameExata = mediaRegularExata.plus(notaExame).div(DOIS);
      mediaPosExameExibida = roundHalfUp(mediaPosExameExata, casasDecimais);
    }
  }

  return {
    resultado: {
      permitido: permiteExameFinal,
      elegivel,
      notaMinimaExame: decimalToNumber(notaMinimaExame),
      mediaAprovacaoExame: decimalToNumber(mediaAprovacaoExame),
      notaExame: notaExame === null ? null : decimalToNumber(notaExame),
      notaNecessariaExame,
      mediaPosExame:
        mediaPosExameExibida === null ? null : decimalToNumber(mediaPosExameExibida),
      mediaPosExameExata:
        mediaPosExameExata === null ? null : formatExact4(mediaPosExameExata),
    },
    mediaPosExameExata,
    mediaPosExameExibida,
  };
}
