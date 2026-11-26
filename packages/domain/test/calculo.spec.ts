import { describe, expect, it } from "vitest";
import {
  calcularDesempenho,
  prioridadePainel,
  simularDesempenho,
  subOrdemPainel,
  type DisciplinaCalculoInput,
} from "../src/index.js";

function baseDisciplina(overrides: Partial<DisciplinaCalculoInput> = {}): DisciplinaCalculoInput {
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
    avaliacoes: [
      { id: "p1", nome: "P1", peso: 40, nota: 8.0, elegivelSubstitutiva: true },
      { id: "p2", nome: "P2", peso: 40, nota: 6.0, elegivelSubstitutiva: true },
      { id: "t", nome: "Trabalho", peso: 20, nota: 9.0, elegivelSubstitutiva: true },
    ],
    ...overrides,
  };
}

describe("CT01 & RF09/RF12/RF15 — Motor de Cálculo @app/domain", () => {
  it("CT01-1A / CA09.1: PONDERADA completa -> média final 7.4 e APROVADO", () => {
    const res = calcularDesempenho(baseDisciplina());
    expect(res.configuracaoCompleta).toBe(true);
    expect(res.somaPesos).toBe(100);
    expect(res.mediaRegular).toBe(7.4);
    expect(res.mediaRegularExata).toBe("7.4000");
    expect(res.mediaFinal).toBe(7.4);
    expect(res.mediaFinalExata).toBe("7.4000");
    expect(res.situacao).toBe("APROVADO");
    expect(res.notaNecessaria.status).toBe("NAO_APLICAVEL");
  });

  it("CA09.2: PONDERADA parcial -> média parcial 8.0, pontos acumulados 3.2, média final null", () => {
    const res = calcularDesempenho(
      baseDisciplina({
        avaliacoes: [
          { id: "p1", nome: "P1", peso: 40, nota: 8.0 },
          { id: "p2", nome: "P2", peso: 40, nota: null },
          { id: "t", nome: "T", peso: 20, nota: null },
        ],
      })
    );
    expect(res.mediaParcial).toBe(8.0);
    expect(res.pontosAcumulados).toBe(3.2);
    expect(res.mediaFinal).toBeNull();
    expect(res.situacao).toBe("EM_ANDAMENTO");
  });

  it("CA09.3: SIMPLES com notas 7.0, 8.0, 6.0 -> média final 7.0", () => {
    const res = calcularDesempenho(
      baseDisciplina({
        metodoCalculo: "SIMPLES",
        avaliacoes: [
          { id: "a1", nome: "A1", peso: 10, nota: 7.0 },
          { id: "a2", nome: "A2", peso: 20, nota: 8.0 },
          { id: "a3", nome: "A3", peso: 70, nota: 6.0 },
        ],
      })
    );
    expect(res.mediaFinal).toBe(7.0);
    expect(res.situacao).toBe("APROVADO");
  });

  it("CA09.4: PONDERADA com soma de pesos 80 -> CONFIGURACAO_INCOMPLETA", () => {
    const res = calcularDesempenho(
      baseDisciplina({
        avaliacoes: [
          { id: "p1", nome: "P1", peso: 40, nota: 8.0 },
          { id: "p2", nome: "P2", peso: 40, nota: 7.0 },
        ],
      })
    );
    expect(res.configuracaoCompleta).toBe(false);
    expect(res.somaPesos).toBe(80);
    expect(res.mediaFinal).toBeNull();
    expect(res.situacao).toBe("CONFIGURACAO_INCOMPLETA");
  });

  it("CT01-1B / CA09.5: Substitutiva substitui P1 (maior ganho ponderado) -> média 6.4 APROVADO", () => {
    const res = calcularDesempenho(
      baseDisciplina({
        notaSubstitutiva: 6.5,
        avaliacoes: [
          { id: "p1", nome: "P1", peso: 40, nota: 3.0, elegivelSubstitutiva: true },
          { id: "p2", nome: "P2", peso: 40, nota: 7.0, elegivelSubstitutiva: true },
          { id: "t", nome: "T", peso: 20, nota: 5.0, elegivelSubstitutiva: false },
        ],
      })
    );
    expect(res.substitutiva.avaliacaoSubstituidaId).toBe("p1");
    expect(res.substitutiva.ganhoMedia).toBe("1.4000");
    expect(res.mediaRegular).toBe(6.4);
    expect(res.situacao).toBe("APROVADO");
  });

  it("RN19 / T33: Substitutiva maximiza ganho ponderado (não apenas menor nota nominal)", () => {
    // P1=4.0 (50%) e P2=3.5 (10%) com Sub=8.0:
    // Substituir P1 => ganho (8-4)*0.5 = +2.0; Substituir P2 => ganho (8-3.5)*0.1 = +0.45
    const res = calcularDesempenho(
      baseDisciplina({
        notaSubstitutiva: 8.0,
        avaliacoes: [
          { id: "p1", nome: "P1", peso: 50, nota: 4.0, elegivelSubstitutiva: true },
          { id: "p2", nome: "P2", peso: 10, nota: 3.5, elegivelSubstitutiva: true },
          { id: "p3", nome: "P3", peso: 40, nota: 7.0, elegivelSubstitutiva: true },
        ],
      })
    );
    expect(res.substitutiva.avaliacaoSubstituidaId).toBe("p1");
    expect(res.substitutiva.ganhoMedia).toBe("2.0000");
  });

  it("CA08.6: Substitutiva menor que todas as notas elegíveis é ignorada (nunca prejudica)", () => {
    const res = calcularDesempenho(
      baseDisciplina({
        notaSubstitutiva: 4.0,
        avaliacoes: [
          { id: "p1", nome: "P1", peso: 50, nota: 7.0, elegivelSubstitutiva: true },
          { id: "p2", nome: "P2", peso: 50, nota: 8.0, elegivelSubstitutiva: true },
        ],
      })
    );
    expect(res.substitutiva.avaliacaoSubstituidaId).toBeNull();
    expect(res.substitutiva.ganhoMedia).toBe("0.0000");
    expect(res.mediaRegular).toBe(7.5);
  });

  it("CT01-1C / CA09.6: Média regular 5.0 -> EM_EXAME_FINAL e com Exame=5.0 -> APROVADO_POS_EXAME", () => {
    const semExame = calcularDesempenho(
      baseDisciplina({
        avaliacoes: [
          { id: "p1", nome: "P1", peso: 50, nota: 4.0 },
          { id: "p2", nome: "P2", peso: 50, nota: 6.0 },
        ],
      })
    );
    expect(semExame.mediaRegular).toBe(5.0);
    expect(semExame.situacao).toBe("EM_EXAME_FINAL");
    expect(semExame.exameFinal.notaNecessariaExame).toBe(5.0);
    expect(semExame.alertaSubstitutivaDisponivel).toBe(true);

    const comExame = calcularDesempenho(
      baseDisciplina({
        notaExame: 5.0,
        avaliacoes: [
          { id: "p1", nome: "P1", peso: 50, nota: 4.0 },
          { id: "p2", nome: "P2", peso: 50, nota: 6.0 },
        ],
      })
    );
    expect(comExame.exameFinal.mediaPosExame).toBe(5.0);
    expect(comExame.mediaFinal).toBe(5.0);
    expect(comExame.situacao).toBe("APROVADO_POS_EXAME");
  });

  it("CA12.1 & CT03-D1: P1=5.0(40), P2(40), T(20), mínima 6.0 -> notaNecessaria 6.7 (EM_RISCO)", () => {
    const res = calcularDesempenho(
      baseDisciplina({
        avaliacoes: [
          { id: "p1", nome: "P1", peso: 40, nota: 5.0 },
          { id: "p2", nome: "P2", peso: 40, nota: null },
          { id: "t", nome: "T", peso: 20, nota: null },
        ],
      })
    );
    expect(res.notaNecessaria.status).toBe("NECESSARIA");
    expect(res.notaNecessaria.valor).toBe(6.7);
    expect(res.notaNecessaria.valorExato).toBe("6.6667");
    expect(res.notaNecessaria.maximoAtingivel).toBe(8.0);
    expect(res.situacao).toBe("EM_RISCO");
  });

  it("CA12.5 & CT03-D2: Média regular 4.6 em exame -> notaNecessariaExame = 5.4", () => {
    const res = calcularDesempenho(
      baseDisciplina({
        avaliacoes: [
          { id: "p1", nome: "P1", peso: 50, nota: 4.6 },
          { id: "p2", nome: "P2", peso: 50, nota: 4.6 },
        ],
      })
    );
    expect(res.situacao).toBe("EM_EXAME_FINAL");
    expect(res.exameFinal.notaNecessariaExame).toBe(5.4);
  });

  it("CA12.6: Calcula nota necessária na substitutiva (6.0 na P1) para evitar Exame Final", () => {
    const res = calcularDesempenho(
      baseDisciplina({
        avaliacoes: [
          { id: "p1", nome: "P1", peso: 40, nota: 3.0, elegivelSubstitutiva: true },
          { id: "p2", nome: "P2", peso: 40, nota: 6.0, elegivelSubstitutiva: true },
          { id: "t", nome: "T", peso: 20, nota: 6.0, elegivelSubstitutiva: true },
        ],
      })
    );
    expect(res.mediaRegular).toBe(4.8);
    expect(res.substitutiva.notaNecessariaParaAprovar).toBe(6.0);
    expect(res.substitutiva.avaliacaoAlvoSubstitutivaId).toBe("p1");
  });

  it("CA15.2: APROVACAO_GARANTIDA quando pontos acumulados >= nota mínima", () => {
    const res = calcularDesempenho(
      baseDisciplina({
        avaliacoes: [
          { id: "p1", nome: "P1", peso: 70, nota: 10.0 },
          { id: "p2", nome: "P2", peso: 30, nota: null },
        ],
      })
    );
    expect(res.pontosAcumulados).toBe(7.0);
    expect(res.notaNecessaria.status).toBe("JA_ATINGIDO");
    expect(res.situacao).toBe("APROVACAO_GARANTIDA");
  });

  it("CA15.3: REPROVACAO_INEVITAVEL quando máximo atingível < notaMinimaExame", () => {
    const res = calcularDesempenho(
      baseDisciplina({
        permiteSubstitutiva: false,
        avaliacoes: [
          { id: "p1", nome: "P1", peso: 80, nota: 0.0 },
          { id: "t", nome: "T", peso: 20, nota: null },
        ],
      })
    );
    expect(res.notaNecessaria.status).toBe("INVIAVEL");
    expect(res.notaNecessaria.maximoAtingivel).toBe(2.0);
    expect(res.situacao).toBe("REPROVACAO_INEVITAVEL");
  });

  it("RF15 #8: AGUARDANDO_SUBSTITUTIVA quando média < 4.0 mas substitutiva ainda pode salvar", () => {
    const res = calcularDesempenho(
      baseDisciplina({
        permiteSubstitutiva: true,
        avaliacoes: [
          { id: "p1", nome: "P1", peso: 50, nota: 1.0, elegivelSubstitutiva: true },
          { id: "p2", nome: "P2", peso: 50, nota: 6.0, elegivelSubstitutiva: true },
        ],
      })
    );
    expect(res.mediaRegular).toBe(3.5);
    expect(res.situacao).toBe("AGUARDANDO_SUBSTITUTIVA");
  });

  it("RF15 #5 & #7: REPROVADO_POS_EXAME e REPROVADO direto", () => {
    const posExame = calcularDesempenho(
      baseDisciplina({
        notaExame: 4.0,
        avaliacoes: [
          { id: "p1", nome: "P1", peso: 50, nota: 4.5 },
          { id: "p2", nome: "P2", peso: 50, nota: 4.5 },
        ],
      })
    );
    expect(posExame.situacao).toBe("REPROVADO_POS_EXAME");

    const direto = calcularDesempenho(
      baseDisciplina({
        permiteSubstitutiva: false,
        avaliacoes: [
          { id: "p1", nome: "P1", peso: 50, nota: 2.0 },
          { id: "p2", nome: "P2", peso: 50, nota: 3.0 },
        ],
      })
    );
    expect(direto.situacao).toBe("REPROVADO");
  });

  it("RF13 / CA13.1: Simulação 'e se' calcula novo desempenho sem mutar entrada", () => {
    const entrada = baseDisciplina({
      avaliacoes: [
        { id: "p1", nome: "P1", peso: 40, nota: 5.0 },
        { id: "p2", nome: "P2", peso: 40, nota: null },
        { id: "t", nome: "T", peso: 20, nota: null },
      ],
    });
    const { desempenhoAtual, desempenhoSimulado } = simularDesempenho(entrada, [
      { avaliacaoId: "p2", nota: 7.0 },
      { avaliacaoId: "t", nota: 8.0 },
    ]);
    expect(desempenhoAtual.situacao).toBe("EM_RISCO");
    expect(desempenhoSimulado.mediaFinal).toBe(6.4);
    expect(desempenhoSimulado.situacao).toBe("APROVADO");
    expect(entrada.avaliacoes[1]?.nota).toBeNull();
  });

  it("CT03: Prioridade de painel ordena [EM_EXAME_FINAL, EM_RISCO, CONFIGURACAO_INCOMPLETA]", () => {
    const lista = [
      { id: "D3", situacao: "CONFIGURACAO_INCOMPLETA" as const },
      { id: "D1", situacao: "EM_RISCO" as const },
      { id: "D2", situacao: "EM_EXAME_FINAL" as const },
    ];
    lista.sort((a, b) => {
      const pDiff = prioridadePainel(a.situacao) - prioridadePainel(b.situacao);
      if (pDiff !== 0) return pDiff;
      return subOrdemPainel(a.situacao) - subOrdemPainel(b.situacao);
    });
    expect(lista.map((x) => x.id)).toEqual(["D2", "D1", "D3"]);
  });
});
