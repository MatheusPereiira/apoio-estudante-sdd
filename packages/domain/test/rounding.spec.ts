import { describe, expect, it } from "vitest";
import { calcularDesempenho, type DisciplinaCalculoInput } from "../src/index.js";

function disc(overrides: Partial<DisciplinaCalculoInput>): DisciplinaCalculoInput {
  return {
    metodoCalculo: "PONDERADA",
    notaMinimaAprovacao: 6.0,
    casasDecimais: 1,
    permiteSubstitutiva: true,
    notaSubstitutiva: null,
    permiteExameFinal: true,
    notaMinimaExame: 4.0,
    mediaAprovacaoExame: 5.0,
    notaExame: null,
    avaliacoes: [],
    ...overrides,
  };
}

describe("CT02 & RF10 — Precisão Decimal Exata e Arredondamento HALF_UP", () => {
  it("CT02-2A / CA10.3: Pesos 33.33 / 33.33 / 33.34 e notas 7 / 8 / 9 -> exato 8.0001, exibido 8.0", () => {
    const res = calcularDesempenho(
      disc({
        avaliacoes: [
          { id: "a1", nome: "A1", peso: 33.33, nota: 7 },
          { id: "a2", nome: "A2", peso: 33.33, nota: 8 },
          { id: "a3", nome: "A3", peso: 33.34, nota: 9 },
        ],
      })
    );
    expect(res.mediaFinalExata).toBe("8.0001");
    expect(res.mediaFinal).toBe(8.0);
    expect(res.situacao).toBe("APROVADO");
  });

  it("CT02-2B / CA10.1: Média exata 6.9500 com 1 casa decimal -> 7.0 (HALF_UP)", () => {
    const res = calcularDesempenho(
      disc({
        avaliacoes: [
          { id: "a1", nome: "A1", peso: 50, nota: 6.9 },
          { id: "a2", nome: "A2", peso: 50, nota: 7.0 },
        ],
      })
    );
    expect(res.mediaFinalExata).toBe("6.9500");
    expect(res.mediaFinal).toBe(7.0);
  });

  it("CT02-2C / CA10.2: Média exata 5.9499 com 1 casa decimal -> exibida 5.9 e EM_EXAME_FINAL", () => {
    const res = calcularDesempenho(
      disc({
        avaliacoes: [
          { id: "a1", nome: "A1", peso: 99, nota: 5.95 },
          { id: "a2", nome: "A2", peso: 1, nota: 5.94 },
        ],
      })
    );
    // (99*5.95 + 1*5.94)/100 = (589.05 + 5.94)/100 = 5.9499
    expect(res.mediaFinalExata).toBe("5.9499");
    expect(res.mediaFinal).toBe(5.9);
    expect(res.situacao).toBe("EM_EXAME_FINAL");
  });

  it("CA10.4: Nenhuma nota lançada -> SEM_NOTAS e médias null", () => {
    const res = calcularDesempenho(
      disc({
        avaliacoes: [
          { id: "a1", nome: "P1", peso: 50, nota: null },
          { id: "a2", nome: "P2", peso: 50, nota: null },
        ],
      })
    );
    expect(res.situacao).toBe("SEM_NOTAS");
    expect(res.mediaParcial).toBeNull();
    expect(res.mediaFinal).toBeNull();
    expect(res.pontosAcumulados).toBeNull();
  });
});
