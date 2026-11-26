import Decimal from "decimal.js";
import { CEM, ZERO, toDecimal } from "./decimal.js";
import type { AvaliacaoInput, MetodoCalculo } from "./types.js";

export interface AvaliacaoNormalizada {
  id: string;
  nome: string;
  pesoInformado: Decimal;
  pesoEfetivo: Decimal;
  nota: Decimal | null;
  elegivelSubstitutiva: boolean;
}

export interface CalculoStrategy {
  readonly metodo: MetodoCalculo;
  normalizarAvaliacoes(avaliacoes: AvaliacaoInput[]): AvaliacaoNormalizada[];
  configuracaoCompleta(avaliacoes: AvaliacaoNormalizada[], somaPesos: Decimal): boolean;
  calcularPontosAcumulados(lancadas: AvaliacaoNormalizada[], totalAvaliacoes: number): Decimal;
  calcularMediaParcial(lancadas: AvaliacaoNormalizada[]): Decimal;
  calcularNotaNecessaria(
    alvo: Decimal,
    lancadas: AvaliacaoNormalizada[],
    pendentes: AvaliacaoNormalizada[],
    totalAvaliacoes: number
  ): Decimal;
}

export class PonderadaStrategy implements CalculoStrategy {
  readonly metodo: MetodoCalculo = "PONDERADA";

  normalizarAvaliacoes(avaliacoes: AvaliacaoInput[]): AvaliacaoNormalizada[] {
    return avaliacoes.map((a) => {
      const peso = toDecimal(a.peso);
      return {
        id: a.id,
        nome: a.nome,
        pesoInformado: peso,
        pesoEfetivo: peso,
        nota: a.nota === null ? null : toDecimal(a.nota),
        elegivelSubstitutiva: a.elegivelSubstitutiva ?? true,
      };
    });
  }

  configuracaoCompleta(avaliacoes: AvaliacaoNormalizada[], somaPesos: Decimal): boolean {
    return avaliacoes.length > 0 && somaPesos.equals(CEM);
  }

  calcularPontosAcumulados(lancadas: AvaliacaoNormalizada[]): Decimal {
    let soma = ZERO;
    for (const av of lancadas) {
      if (av.nota !== null) {
        soma = soma.plus(av.nota.times(av.pesoEfetivo));
      }
    }
    return soma.div(CEM);
  }

  calcularMediaParcial(lancadas: AvaliacaoNormalizada[]): Decimal {
    let numerador = ZERO;
    let denominador = ZERO;
    for (const av of lancadas) {
      if (av.nota !== null) {
        numerador = numerador.plus(av.nota.times(av.pesoEfetivo));
        denominador = denominador.plus(av.pesoEfetivo);
      }
    }
    return denominador.isZero() ? ZERO : numerador.div(denominador);
  }

  calcularNotaNecessaria(
    alvo: Decimal,
    lancadas: AvaliacaoNormalizada[],
    pendentes: AvaliacaoNormalizada[]
  ): Decimal {
    let somaLancadas = ZERO;
    for (const av of lancadas) {
      if (av.nota !== null) {
        somaLancadas = somaLancadas.plus(av.nota.times(av.pesoEfetivo));
      }
    }
    let pesoPendente = ZERO;
    for (const av of pendentes) {
      pesoPendente = pesoPendente.plus(av.pesoEfetivo);
    }
    return alvo.times(CEM).minus(somaLancadas).div(pesoPendente);
  }
}

export class SimplesStrategy implements CalculoStrategy {
  readonly metodo: MetodoCalculo = "SIMPLES";

  normalizarAvaliacoes(avaliacoes: AvaliacaoInput[]): AvaliacaoNormalizada[] {
    const n = avaliacoes.length;
    const pesoIgual = n > 0 ? CEM.div(n) : ZERO;
    return avaliacoes.map((a) => ({
      id: a.id,
      nome: a.nome,
      pesoInformado: toDecimal(a.peso),
      pesoEfetivo: pesoIgual,
      nota: a.nota === null ? null : toDecimal(a.nota),
      elegivelSubstitutiva: a.elegivelSubstitutiva ?? true,
    }));
  }

  configuracaoCompleta(avaliacoes: AvaliacaoNormalizada[]): boolean {
    return avaliacoes.length > 0;
  }

  calcularPontosAcumulados(lancadas: AvaliacaoNormalizada[], totalAvaliacoes: number): Decimal {
    if (totalAvaliacoes === 0) return ZERO;
    let soma = ZERO;
    for (const av of lancadas) {
      if (av.nota !== null) {
        soma = soma.plus(av.nota);
      }
    }
    return soma.div(totalAvaliacoes);
  }

  calcularMediaParcial(lancadas: AvaliacaoNormalizada[]): Decimal {
    if (lancadas.length === 0) return ZERO;
    let soma = ZERO;
    for (const av of lancadas) {
      if (av.nota !== null) {
        soma = soma.plus(av.nota);
      }
    }
    return soma.div(lancadas.length);
  }

  calcularNotaNecessaria(
    alvo: Decimal,
    lancadas: AvaliacaoNormalizada[],
    pendentes: AvaliacaoNormalizada[],
    totalAvaliacoes: number
  ): Decimal {
    let somaLancadas = ZERO;
    for (const av of lancadas) {
      if (av.nota !== null) {
        somaLancadas = somaLancadas.plus(av.nota);
      }
    }
    return alvo.times(totalAvaliacoes).minus(somaLancadas).div(pendentes.length);
  }
}

export function obterStrategy(metodo: MetodoCalculo): CalculoStrategy {
  return metodo === "SIMPLES" ? new SimplesStrategy() : new PonderadaStrategy();
}
