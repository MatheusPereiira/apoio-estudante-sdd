import { DomainError, notFoundError, type SimulacaoInput } from "@app/contracts";
import {
  calcularDesempenho,
  prioridadePainel,
  simularDesempenho,
  subOrdemPainel,
  type SituacaoDisciplina,
} from "@app/domain";
import { toCalculoInput } from "./disciplina-service.js";
import type { AppRepositoryPort } from "./ports.js";

export class PainelService {
  constructor(private readonly repo: AppRepositoryPort) {}

  /** E27 — Desempenho da disciplina */
  async getDesempenho(usuarioId: string, disciplinaId: string) {
    const disciplina = await this.repo.findDisciplinaById(usuarioId, disciplinaId);
    if (!disciplina) throw notFoundError("Disciplina não encontrada.");

    const avaliacoes = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplinaId);
    return calcularDesempenho(toCalculoInput(disciplina, avaliacoes));
  }

  /** E28 — Nota necessária (RF12 / CA12.1–CA12.6) */
  async getNotaNecessaria(usuarioId: string, disciplinaId: string, alvo?: number) {
    const disciplina = await this.repo.findDisciplinaById(usuarioId, disciplinaId);
    if (!disciplina) throw notFoundError("Disciplina não encontrada.");

    const avaliacoes = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplinaId);
    const alvoFinal = alvo ?? disciplina.notaMinimaAprovacao;
    const desempenho = calcularDesempenho(toCalculoInput(disciplina, avaliacoes), alvoFinal);

    return {
      alvo: alvoFinal,
      ...desempenho.notaNecessaria,
      substitutiva: desempenho.substitutiva,
      exameFinal: desempenho.exameFinal,
      avaliacoesPendentes: avaliacoes
        .filter((a) => a.nota === null)
        .map((a) => ({ id: a.id, nome: a.nome, peso: a.peso })),
    };
  }

  /** E29 — Simulação "E se?" sem persistência (RF13 / RN13 / CA13.1–CA13.3) */
  async simular(usuarioId: string, disciplinaId: string, input: SimulacaoInput) {
    const disciplina = await this.repo.findDisciplinaById(usuarioId, disciplinaId);
    if (!disciplina) throw notFoundError("Disciplina não encontrada.");

    const avaliacoes = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplinaId);
    const idsValidos = new Set(avaliacoes.map((a) => a.id));

    for (const item of input.notasHipoteticas) {
      if (!idsValidos.has(item.avaliacaoId)) {
        throw new DomainError({
          status: 422,
          code: "VALIDACAO",
          title: "Avaliação inválida na simulação",
          detail: "Todas as avaliações simuladas devem pertencer a esta disciplina.",
        });
      }
    }

    const { desempenhoAtual, desempenhoSimulado } = simularDesempenho(
      toCalculoInput(disciplina, avaliacoes),
      input.notasHipoteticas,
      {
        notaSubstitutiva: input.notaSubstitutiva,
        notaExame: input.notaExame,
      }
    );

    return {
      persistido: false as const,
      desempenhoAtual,
      desempenhoSimulado,
    };
  }

  /** E31 — Painel do período ordenado por criticidade (RF14 / RF15 / CA14.1 / CT03) */
  async getPainelPeriodo(usuarioId: string, periodoId: string) {
    const periodo = await this.repo.findPeriodoById(usuarioId, periodoId);
    if (!periodo) throw notFoundError("Período letivo não encontrado.");

    // 2 consultas indexadas conforme data-model.md §6
    const [disciplinas, avaliacoesPeriodo] = await Promise.all([
      this.repo.listDisciplinasByPeriodo(usuarioId, periodoId),
      this.repo.listAvaliacoesByPeriodo(usuarioId, periodoId),
    ]);

    const avaliacoesPorDisc = new Map<string, typeof avaliacoesPeriodo>();
    for (const av of avaliacoesPeriodo) {
      const lista = avaliacoesPorDisc.get(av.disciplinaId) ?? [];
      lista.push(av);
      avaliacoesPorDisc.set(av.disciplinaId, lista);
    }

    // Data atual no fuso America/Sao_Paulo (RNF21)
    const hojeIso = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
    }).format(new Date());

    const porSituacao: Partial<Record<SituacaoDisciplina, number>> = {};

    const cards = disciplinas.map((d) => {
      const avs = avaliacoesPorDisc.get(d.id) ?? [];
      const desempenho = calcularDesempenho(toCalculoInput(d, avs));
      porSituacao[desempenho.situacao] = (porSituacao[desempenho.situacao] ?? 0) + 1;

      const pendentesComData = avs
        .filter((a) => a.nota === null && a.dataPrevista !== null && a.dataPrevista >= hojeIso)
        .sort((a, b) => (a.dataPrevista ?? "").localeCompare(b.dataPrevista ?? ""));

      const proxima = pendentesComData[0] ?? avs.find((a) => a.nota === null) ?? null;

      return {
        id: d.id,
        nome: d.nome,
        codigo: d.codigo,
        metodoCalculo: d.metodoCalculo,
        notaMinimaAprovacao: d.notaMinimaAprovacao,
        versao: d.versao,
        situacao: desempenho.situacao,
        prioridade: prioridadePainel(desempenho.situacao),
        mediaParcial: desempenho.mediaParcial,
        pontosAcumulados: desempenho.pontosAcumulados,
        mediaRegular: desempenho.mediaRegular,
        mediaFinal: desempenho.mediaFinal,
        somaPesos: desempenho.somaPesos,
        pesoLancado: desempenho.pesoLancado,
        notaNecessaria: desempenho.notaNecessaria,
        substitutiva: desempenho.substitutiva,
        exameFinal: desempenho.exameFinal,
        alertaSubstitutivaDisponivel: desempenho.alertaSubstitutivaDisponivel,
        avaliacoes: avs,
        proximaAvaliacao: proxima
          ? {
              id: proxima.id,
              nome: proxima.nome,
              dataPrevista: proxima.dataPrevista,
              peso: proxima.peso,
              versao: proxima.versao,
            }
          : null,
      };
    });

    cards.sort((a, b) => {
      const pDiff = a.prioridade - b.prioridade;
      if (pDiff !== 0) return pDiff;
      const subDiff = subOrdemPainel(a.situacao) - subOrdemPainel(b.situacao);
      if (subDiff !== 0) return subDiff;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });

    const discNomeMap = new Map(disciplinas.map((d) => [d.id, d.nome]));
    const proximasAvaliacoes = avaliacoesPeriodo
      .filter((a) => a.nota === null && a.dataPrevista !== null && a.dataPrevista >= hojeIso)
      .sort((a, b) => (a.dataPrevista ?? "").localeCompare(b.dataPrevista ?? ""))
      .slice(0, 10)
      .map((a) => ({
        disciplinaId: a.disciplinaId,
        disciplinaNome: discNomeMap.get(a.disciplinaId) ?? "",
        avaliacaoId: a.id,
        nome: a.nome,
        peso: a.peso,
        versao: a.versao,
        dataPrevista: a.dataPrevista!,
      }));

    return {
      periodo: { id: periodo.id, nome: periodo.nome },
      resumo: {
        totalDisciplinas: disciplinas.length,
        porSituacao,
      },
      disciplinas: cards,
      proximasAvaliacoes,
    };
  }
}
