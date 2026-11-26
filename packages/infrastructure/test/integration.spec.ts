import { describe, expect, it } from "vitest";
import { createContainer, InMemoryAppRepository } from "../src/index.js";

describe("Integração F1 + F2 + F3 + LGPD (CT01, CT03, CA01–CA15)", () => {
  it("CT03 & Fluxo Completo: cadastro -> período -> 3 disciplinas -> notas -> painel ordenado -> export -> exclusão LGPD", async () => {
    const repo = new InMemoryAppRepository();
    const app = createContainer({ repo });

    // CA01.1 & CA01.2
    const { usuario } = await app.auth.register({
      nome: "Ana Souza",
      email: "ana@example.test",
      senha: "SenhaForte2026",
      aceiteTermos: true,
      termosVersao: "2026-11",
    });

    await expect(
      app.auth.register({
        nome: "Outra",
        email: "ANA@example.test",
        senha: "SenhaForte2026",
        aceiteTermos: true,
        termosVersao: "2026-11",
      })
    ).rejects.toMatchObject({ status: 422, code: "CADASTRO_INVALIDO" });

    // RF04: Período
    const p = await app.periodos.create(usuario.id, {
      nome: "2026.2",
      dataInicio: "2026-08-03",
      dataFim: "2026-12-12",
    });

    // D1: P1=5.0(40), P2(40), T(20) -> EM_RISCO, notaNecessaria=6.7
    const d1 = await app.disciplinas.create(usuario.id, p.id, {
      nome: "Cálculo I",
      metodoCalculo: "PONDERADA",
      notaMinimaAprovacao: 6.0,
      casasDecimais: 1,
      permiteSubstitutiva: true,
      permiteExameFinal: true,
      notaMinimaExame: 4.0,
      mediaAprovacaoExame: 5.0,
    });
    const d1p1 = await app.avaliacoes.create(usuario.id, d1.id, {
      nome: "P1",
      peso: 40,
      elegivelSubstitutiva: true,
    });
    const d1p2 = await app.avaliacoes.create(usuario.id, d1.id, {
      nome: "P2",
      peso: 40,
      elegivelSubstitutiva: true,
    });
    const d1t = await app.avaliacoes.create(usuario.id, d1.id, {
      nome: "Trabalho",
      peso: 20,
      elegivelSubstitutiva: false,
    });

    // CA06.2: Peso excedendo 100% -> 422 SOMA_PESOS_EXCEDIDA
    await expect(
      app.avaliacoes.create(usuario.id, d1.id, {
        nome: "Extra",
        peso: 10,
        elegivelSubstitutiva: false,
      })
    ).rejects.toMatchObject({ status: 422, code: "SOMA_PESOS_EXCEDIDA" });

    const notaRes = await app.avaliacoes.setNota(usuario.id, d1p1.avaliacao.id, {
      nota: 5.0,
      versao: 1,
    });
    expect(notaRes.historico?.acao).toBe("LANCADA");
    expect(notaRes.desempenho.notaNecessaria.valor).toBe(6.7);
    expect(notaRes.desempenho.situacao).toBe("EM_RISCO");

    // CA13.1 & CA13.2: Simulação "e se" não persiste notas
    const sim = await app.painel.simular(usuario.id, d1.id, {
      notasHipoteticas: [
        { avaliacaoId: d1p2.avaliacao.id, nota: 7.0 },
        { avaliacaoId: d1t.avaliacao.id, nota: 8.0 },
      ],
    });
    expect(sim.persistido).toBe(false);
    expect(sim.desempenhoSimulado.mediaFinal).toBe(6.4);
    expect(sim.desempenhoSimulado.situacao).toBe("APROVADO");
    expect((await app.disciplinas.getById(usuario.id, d1.id)).avaliacoes[1]?.nota).toBeNull();

    // D2: Fechada com média 4.6 -> EM_EXAME_FINAL, notaNecessariaExame = 5.4
    const d2 = await app.disciplinas.create(usuario.id, p.id, {
      nome: "Física I",
      metodoCalculo: "PONDERADA",
      notaMinimaAprovacao: 6.0,
      casasDecimais: 1,
      permiteSubstitutiva: true,
      permiteExameFinal: true,
      notaMinimaExame: 4.0,
      mediaAprovacaoExame: 5.0,
    });
    const d2p1 = await app.avaliacoes.create(usuario.id, d2.id, {
      nome: "P1",
      peso: 50,
      elegivelSubstitutiva: true,
    });
    const d2p2 = await app.avaliacoes.create(usuario.id, d2.id, {
      nome: "P2",
      peso: 50,
      elegivelSubstitutiva: true,
    });
    await app.avaliacoes.setNota(usuario.id, d2p1.avaliacao.id, { nota: 4.6, versao: 1 });
    await app.avaliacoes.setNota(usuario.id, d2p2.avaliacao.id, { nota: 4.6, versao: 1 });

    // D3: Soma 80% -> CONFIGURACAO_INCOMPLETA
    const d3 = await app.disciplinas.create(usuario.id, p.id, {
      nome: "Algoritmos",
      metodoCalculo: "PONDERADA",
      notaMinimaAprovacao: 6.0,
      casasDecimais: 1,
      permiteSubstitutiva: true,
      permiteExameFinal: true,
      notaMinimaExame: 4.0,
      mediaAprovacaoExame: 5.0,
    });
    await app.avaliacoes.create(usuario.id, d3.id, {
      nome: "P1",
      peso: 80,
      elegivelSubstitutiva: true,
    });

    // CT03: Painel ordena [D2 (EM_EXAME_FINAL), D1 (EM_RISCO), D3 (CONFIGURACAO_INCOMPLETA)]
    const painel = await app.painel.getPainelPeriodo(usuario.id, p.id);
    expect(painel.disciplinas.map((x) => x.nome)).toEqual(["Física I", "Cálculo I", "Algoritmos"]);
    expect(painel.disciplinas[0]?.exameFinal.notaNecessariaExame).toBe(5.4);
    expect(painel.disciplinas[1]?.notaNecessaria.valor).toBe(6.7);

    // E34: Lançar Exame Final 5.4 em D2 -> média pós-exame 5.0 -> APROVADO_POS_EXAME
    const exameRes = await app.avaliacoes.setExameFinal(usuario.id, d2.id, {
      nota: 5.4,
      versao: 1,
    });
    expect(exameRes.desempenho.exameFinal.mediaPosExame).toBe(5.0);
    expect(exameRes.desempenho.situacao).toBe("APROVADO_POS_EXAME");

    // E08: Export LGPD
    const exported = await app.auth.exportMe(usuario.id);
    expect(exported.periodos).toHaveLength(1);
    expect(exported.periodos[0]?.disciplinas).toHaveLength(3);

    // E09 / CA03.3 & CA03.2: Exclusão LGPD em cascata
    await expect(
      app.auth.deleteMe(usuario.id, {
        senha: "SenhaErrada",
        confirmacao: "EXCLUIR MINHA CONTA",
      })
    ).rejects.toMatchObject({ status: 401, code: "CREDENCIAIS_INVALIDAS" });

    await app.auth.deleteMe(usuario.id, {
      senha: "SenhaForte2026",
      confirmacao: "EXCLUIR MINHA CONTA",
    });
    expect(await repo.findUsuarioById(usuario.id)).toBeNull();
    expect(await repo.listPeriodos(usuario.id)).toHaveLength(0);
  });
});
