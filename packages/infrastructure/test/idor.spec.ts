import { describe, expect, it } from "vitest";
import { DomainError } from "@app/contracts";
import { createContainer, InMemoryAppRepository } from "../src/index.js";

async function expectNotFound(fn: () => Promise<unknown>) {
  try {
    await fn();
    expect.fail("Deveria ter lançado DomainError 404 NAO_ENCONTRADO");
  } catch (err) {
    expect(err).toBeInstanceOf(DomainError);
    const dErr = err as DomainError;
    expect(dErr.status).toBe(404);
    expect(dErr.code).toBe("NAO_ENCONTRADO");
  }
}

describe("CT04 — Suíte Bloqueante de Autorização e Isolamento Zero IDOR (RN01 / RNF09 / C3)", () => {
  it("Usuário B recebe 404 NAO_ENCONTRADO em 100% das operações sobre recursos do Usuário A", async () => {
    const repo = new InMemoryAppRepository();
    const app = createContainer({ repo });

    const { usuario: ana } = await app.auth.register({
      nome: "Ana Souza",
      email: "ana@example.test",
      senha: "SenhaForte2026",
      aceiteTermos: true,
      termosVersao: "2026-11",
    });

    const { usuario: bruno } = await app.auth.register({
      nome: "Bruno Lima",
      email: "bruno@example.test",
      senha: "SenhaForte2026",
      aceiteTermos: true,
      termosVersao: "2026-11",
    });

    // Ana cria período, disciplina, avaliações e lança nota
    const pA = await app.periodos.create(ana.id, { nome: "2026.2" });
    const dA = await app.disciplinas.create(ana.id, pA.id, {
      nome: "Cálculo I",
      metodoCalculo: "PONDERADA",
      notaMinimaAprovacao: 6.0,
      casasDecimais: 1,
      permiteSubstitutiva: true,
      permiteExameFinal: true,
      notaMinimaExame: 4.0,
      mediaAprovacaoExame: 5.0,
    });
    const aA = await app.avaliacoes.create(ana.id, dA.id, {
      nome: "P1",
      peso: 100,
      elegivelSubstitutiva: true,
    });
    await app.avaliacoes.setNota(ana.id, aA.avaliacao.id, { nota: 5.0, versao: 1 });

    // Bruno tenta acessar/alterar/deletar TODOS os recursos de Ana
    await expectNotFound(() => app.periodos.getById(bruno.id, pA.id));
    await expectNotFound(() => app.periodos.update(bruno.id, pA.id, { nome: "Hack", versao: 1 }));
    await expectNotFound(() => app.periodos.delete(bruno.id, pA.id, true));
    await expectNotFound(() => app.painel.getPainelPeriodo(bruno.id, pA.id));

    await expectNotFound(() => app.disciplinas.listByPeriodo(bruno.id, pA.id));
    await expectNotFound(() =>
      app.disciplinas.create(bruno.id, pA.id, {
        nome: "Invadida",
        metodoCalculo: "PONDERADA",
        notaMinimaAprovacao: 6,
        casasDecimais: 1,
        permiteSubstitutiva: true,
        permiteExameFinal: true,
        notaMinimaExame: 4,
        mediaAprovacaoExame: 5,
      })
    );
    await expectNotFound(() => app.disciplinas.getById(bruno.id, dA.id));
    await expectNotFound(() =>
      app.disciplinas.update(bruno.id, dA.id, { nome: "Hack", versao: 1, confirmar: true })
    );
    await expectNotFound(() => app.disciplinas.delete(bruno.id, dA.id, true));
    await expectNotFound(() => app.disciplinas.previewCriteria(bruno.id, dA.id, {}));

    await expectNotFound(() =>
      app.avaliacoes.create(bruno.id, dA.id, { nome: "Hack", peso: 10, elegivelSubstitutiva: true })
    );
    await expectNotFound(() =>
      app.avaliacoes.update(bruno.id, aA.avaliacao.id, { nome: "Hack", versao: 2 })
    );
    await expectNotFound(() => app.avaliacoes.delete(bruno.id, aA.avaliacao.id, true));
    await expectNotFound(() => app.avaliacoes.reorder(bruno.id, dA.id, [aA.avaliacao.id]));
    await expectNotFound(() =>
      app.avaliacoes.setNota(bruno.id, aA.avaliacao.id, { nota: 0, versao: 2 })
    );
    await expectNotFound(() => app.avaliacoes.removeNota(bruno.id, aA.avaliacao.id, 2));
    await expectNotFound(() => app.avaliacoes.listHistorico(bruno.id, aA.avaliacao.id, 20));
    await expectNotFound(() =>
      app.avaliacoes.setSubstitutiva(bruno.id, dA.id, { nota: 10, versao: 1 })
    );
    await expectNotFound(() => app.avaliacoes.removeSubstitutiva(bruno.id, dA.id, 1));
    await expectNotFound(() =>
      app.avaliacoes.setExameFinal(bruno.id, dA.id, { nota: 10, versao: 1 })
    );
    await expectNotFound(() => app.avaliacoes.removeExameFinal(bruno.id, dA.id, 1));

    await expectNotFound(() => app.painel.getDesempenho(bruno.id, dA.id));
    await expectNotFound(() => app.painel.getNotaNecessaria(bruno.id, dA.id));
    await expectNotFound(() =>
      app.painel.simular(bruno.id, dA.id, {
        notasHipoteticas: [{ avaliacaoId: aA.avaliacao.id, nota: 10 }],
      })
    );

    // Estado dos dados de Ana permanece 100% íntegro
    const discAna = await app.disciplinas.getById(ana.id, dA.id);
    expect(discAna.nome).toBe("Cálculo I");
    expect(discAna.versao).toBe(1);
    expect(discAna.avaliacoes[0]?.nota).toBe(5.0);
    expect(discAna.avaliacoes[0]?.versao).toBe(2);
  });
});
