import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { calcularDesempenho, type CasasDecimais } from "../src/index.js";

const notaArb = fc.integer({ min: 0, max: 1000 }).map((n) => n / 100);
const casasArb = fc.constantFrom<CasasDecimais>(0, 1, 2);

/**
 * Gera k pesos positivos com 2 casas decimais cuja soma é exatamente 100.00.
 */
function pesosSomando100Arb(minCount = 2, maxCount = 6): fc.Arbitrary<number[]> {
  return fc
    .integer({ min: minCount, max: maxCount })
    .chain((count) =>
      fc
        .array(fc.integer({ min: 1, max: 100 }), { minLength: count, maxLength: count })
        .map((raw) => {
          const totalRaw = raw.reduce((a, b) => a + b, 0);
          const centesimos = raw.map((v) => Math.max(1, Math.floor((v * 10000) / totalRaw)));
          const somaParcial = centesimos.reduce((a, b) => a + b, 0);
          const diff = 10000 - somaParcial;
          centesimos[centesimos.length - 1] = (centesimos[centesimos.length - 1] ?? 1) + diff;
          return centesimos.map((c) => c / 100);
        })
    )
    .filter((pesos) => pesos.every((p) => p > 0 && p <= 100));
}

describe("Propriedades Matemáticas Invariantes — fast-check (test-plan.md §3)", () => {
  it("P1 (Limites): mediaParcial, mediaRegular e mediaPosExame pertencem sempre a [0, 10]", () => {
    fc.assert(
      fc.property(
        pesosSomando100Arb(1, 5),
        fc.array(notaArb, { minLength: 5, maxLength: 5 }),
        notaArb,
        notaArb,
        casasArb,
        (pesos, notasPool, notaSub, notaExame, casas) => {
          const avaliacoes = pesos.map((peso, i) => ({
            id: `a${i}`,
            nome: `A${i}`,
            peso,
            nota: notasPool[i] ?? 0,
            elegivelSubstitutiva: true,
          }));

          const res = calcularDesempenho({
            metodoCalculo: "PONDERADA",
            notaMinimaAprovacao: 6.0,
            casasDecimais: casas,
            permiteSubstitutiva: true,
            notaSubstitutiva: notaSub,
            permiteExameFinal: true,
            notaMinimaExame: 4.0,
            mediaAprovacaoExame: 5.0,
            notaExame,
            avaliacoes,
          });

          if (res.mediaParcial !== null) {
            expect(res.mediaParcial).toBeGreaterThanOrEqual(0);
            expect(res.mediaParcial).toBeLessThanOrEqual(10);
          }
          if (res.mediaRegular !== null) {
            expect(res.mediaRegular).toBeGreaterThanOrEqual(0);
            expect(res.mediaRegular).toBeLessThanOrEqual(10);
          }
          if (res.exameFinal.mediaPosExame !== null) {
            expect(res.exameFinal.mediaPosExame).toBeGreaterThanOrEqual(0);
            expect(res.exameFinal.mediaPosExame).toBeLessThanOrEqual(10);
          }
        }
      ),
      { numRuns: 1000 }
    );
  });

  it("P2 (Equivalência): SIMPLES para n avaliações equivale a PONDERADA com pesos 100/n", () => {
    // Usa n divisores exatos de 100 para peso decimal exato (1, 2, 4, 5, 10)
    fc.assert(
      fc.property(
        fc.constantFrom(1, 2, 4, 5, 10).chain((n) =>
          fc.tuple(
            fc.constant(n),
            fc.array(notaArb, { minLength: n, maxLength: n })
          )
        ),
        casasArb,
        ([n, notas], casas) => {
          const pesoIgual = 100 / n;
          const avaliacoes = notas.map((nota, i) => ({
            id: `a${i}`,
            nome: `A${i}`,
            peso: pesoIgual,
            nota,
          }));

          const simples = calcularDesempenho({
            metodoCalculo: "SIMPLES",
            notaMinimaAprovacao: 6.0,
            casasDecimais: casas,
            permiteSubstitutiva: false,
            notaSubstitutiva: null,
            permiteExameFinal: false,
            notaMinimaExame: 4.0,
            mediaAprovacaoExame: 5.0,
            notaExame: null,
            avaliacoes,
          });

          const ponderada = calcularDesempenho({
            metodoCalculo: "PONDERADA",
            notaMinimaAprovacao: 6.0,
            casasDecimais: casas,
            permiteSubstitutiva: false,
            notaSubstitutiva: null,
            permiteExameFinal: false,
            notaMinimaExame: 4.0,
            mediaAprovacaoExame: 5.0,
            notaExame: null,
            avaliacoes,
          });

          expect(simples.mediaRegularExata).toBe(ponderada.mediaRegularExata);
          expect(simples.mediaFinal).toBe(ponderada.mediaFinal);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it("P3 (Monotonicidade): aumentar uma nota nunca diminui pontosAcumulados nem mediaRegular", () => {
    fc.assert(
      fc.property(
        pesosSomando100Arb(2, 5),
        fc.array(notaArb, { minLength: 5, maxLength: 5 }),
        fc.integer({ min: 1, max: 300 }).map((d) => d / 100),
        (pesos, notasPool, delta) => {
          const baseAvaliacoes = pesos.map((peso, i) => ({
            id: `a${i}`,
            nome: `A${i}`,
            peso,
            nota: notasPool[i] ?? 0,
          }));

          const aumentadas = baseAvaliacoes.map((a, idx) =>
            idx === 0 ? { ...a, nota: Math.min(10, Number((a.nota + delta).toFixed(2))) } : a
          );

          const base = calcularDesempenho({
            metodoCalculo: "PONDERADA",
            notaMinimaAprovacao: 6.0,
            casasDecimais: 2,
            permiteSubstitutiva: false,
            notaSubstitutiva: null,
            permiteExameFinal: false,
            notaMinimaExame: 4.0,
            mediaAprovacaoExame: 5.0,
            notaExame: null,
            avaliacoes: baseAvaliacoes,
          });

          const depois = calcularDesempenho({
            metodoCalculo: "PONDERADA",
            notaMinimaAprovacao: 6.0,
            casasDecimais: 2,
            permiteSubstitutiva: false,
            notaSubstitutiva: null,
            permiteExameFinal: false,
            notaMinimaExame: 4.0,
            mediaAprovacaoExame: 5.0,
            notaExame: null,
            avaliacoes: aumentadas,
          });

          expect(depois.pontosAcumulados!).toBeGreaterThanOrEqual(base.pontosAcumulados!);
          expect(depois.mediaRegular!).toBeGreaterThanOrEqual(base.mediaRegular!);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it("P4 (Não-Prejuízo da Substitutiva — RN19): mediaRegularComSub >= mediaRegularSemSub", () => {
    fc.assert(
      fc.property(
        pesosSomando100Arb(2, 5),
        fc.array(notaArb, { minLength: 5, maxLength: 5 }),
        notaArb,
        (pesos, notasPool, notaSub) => {
          const avaliacoes = pesos.map((peso, i) => ({
            id: `a${i}`,
            nome: `A${i}`,
            peso,
            nota: notasPool[i] ?? 0,
            elegivelSubstitutiva: true,
          }));

          const semSub = calcularDesempenho({
            metodoCalculo: "PONDERADA",
            notaMinimaAprovacao: 6.0,
            casasDecimais: 2,
            permiteSubstitutiva: true,
            notaSubstitutiva: null,
            permiteExameFinal: true,
            notaMinimaExame: 4.0,
            mediaAprovacaoExame: 5.0,
            notaExame: null,
            avaliacoes,
          });

          const comSub = calcularDesempenho({
            metodoCalculo: "PONDERADA",
            notaMinimaAprovacao: 6.0,
            casasDecimais: 2,
            permiteSubstitutiva: true,
            notaSubstitutiva: notaSub,
            permiteExameFinal: true,
            notaMinimaExame: 4.0,
            mediaAprovacaoExame: 5.0,
            notaExame: null,
            avaliacoes,
          });

          expect(comSub.mediaRegular!).toBeGreaterThanOrEqual(semSub.mediaRegular!);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it("P5 (Conservadorismo da Nota Necessária — RN10): aplicar x às pendentes garante mediaFinal >= alvo", () => {
    fc.assert(
      fc.property(
        pesosSomando100Arb(2, 5),
        notaArb,
        fc.integer({ min: 10, max: 90 }).map((n) => n / 10),
        casasArb,
        (pesos, notaP1, alvo, casas) => {
          const avaliacoes = pesos.map((peso, i) => ({
            id: `a${i}`,
            nome: `A${i}`,
            peso,
            nota: i === 0 ? notaP1 : null,
          }));

          const parcial = calcularDesempenho(
            {
              metodoCalculo: "PONDERADA",
              notaMinimaAprovacao: alvo,
              casasDecimais: casas,
              permiteSubstitutiva: false,
              notaSubstitutiva: null,
              permiteExameFinal: false,
              notaMinimaExame: 4.0,
              mediaAprovacaoExame: 5.0,
              notaExame: null,
              avaliacoes,
            },
            alvo
          );

          if (parcial.notaNecessaria.status === "NECESSARIA" && parcial.notaNecessaria.valor !== null) {
            const x = parcial.notaNecessaria.valor;
            const fechada = calcularDesempenho({
              metodoCalculo: "PONDERADA",
              notaMinimaAprovacao: alvo,
              casasDecimais: casas,
              permiteSubstitutiva: false,
              notaSubstitutiva: null,
              permiteExameFinal: false,
              notaMinimaExame: 4.0,
              mediaAprovacaoExame: 5.0,
              notaExame: null,
              avaliacoes: avaliacoes.map((a) => (a.nota === null ? { ...a, nota: x } : a)),
            });

            expect(fechada.mediaFinal!).toBeGreaterThanOrEqual(
              Number(alvo.toFixed(casas))
            );
          }
        }
      ),
      { numRuns: 1000 }
    );
  });

  it("P6 (Nota Pendente != Zero — RN05): nota null difere de nota 0 na mediaParcial quando demais > 0", () => {
    fc.assert(
      fc.property(
        pesosSomando100Arb(2, 4),
        fc.integer({ min: 10, max: 1000 }).map((n) => n / 100),
        (pesos, notaPositiva) => {
          const comPendente = calcularDesempenho({
            metodoCalculo: "PONDERADA",
            notaMinimaAprovacao: 6.0,
            casasDecimais: 2,
            permiteSubstitutiva: false,
            notaSubstitutiva: null,
            permiteExameFinal: false,
            notaMinimaExame: 4.0,
            mediaAprovacaoExame: 5.0,
            notaExame: null,
            avaliacoes: pesos.map((peso, i) => ({
              id: `a${i}`,
              nome: `A${i}`,
              peso,
              nota: i === 0 ? notaPositiva : null,
            })),
          });

          const comZero = calcularDesempenho({
            metodoCalculo: "PONDERADA",
            notaMinimaAprovacao: 6.0,
            casasDecimais: 2,
            permiteSubstitutiva: false,
            notaSubstitutiva: null,
            permiteExameFinal: false,
            notaMinimaExame: 4.0,
            mediaAprovacaoExame: 5.0,
            notaExame: null,
            avaliacoes: pesos.map((peso, i) => ({
              id: `a${i}`,
              nome: `A${i}`,
              peso,
              nota: i === 0 ? notaPositiva : 0,
            })),
          });

          expect(comPendente.mediaParcialExata).not.toBe(comZero.mediaParcialExata);
        }
      ),
      { numRuns: 1000 }
    );
  });
});
