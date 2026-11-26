import {
  DomainError,
  notFoundError,
  type CreateDisciplinaInput,
  type PreviaCriteriosInput,
  type UpdateDisciplinaInput,
} from "@app/contracts";
import { calcularDesempenho, type DisciplinaCalculoInput } from "@app/domain";
import type { AppRepositoryPort, AvaliacaoRecord, DisciplinaRecord } from "./ports.js";

const MAX_DISCIPLINAS_POR_PERIODO = 15;

export function toCalculoInput(
  d: DisciplinaRecord,
  avaliacoes: AvaliacaoRecord[]
): DisciplinaCalculoInput {
  return {
    metodoCalculo: d.metodoCalculo,
    notaMinimaAprovacao: d.notaMinimaAprovacao,
    casasDecimais: d.casasDecimais,
    permiteSubstitutiva: d.permiteSubstitutiva,
    notaSubstitutiva: d.notaSubstitutiva,
    permiteExameFinal: d.permiteExameFinal,
    notaMinimaExame: d.notaMinimaExame,
    mediaAprovacaoExame: d.mediaAprovacaoExame,
    notaExame: d.notaExame,
    avaliacoes: avaliacoes.map((a) => ({
      id: a.id,
      nome: a.nome,
      peso: a.peso,
      nota: a.nota,
      elegivelSubstitutiva: a.elegivelSubstitutiva,
    })),
  };
}

export class DisciplinaService {
  constructor(private readonly repo: AppRepositoryPort) {}

  /** E15 — Listar disciplinas de um período */
  async listByPeriodo(usuarioId: string, periodoId: string) {
    const periodo = await this.repo.findPeriodoById(usuarioId, periodoId);
    if (!periodo) throw notFoundError("Período letivo não encontrado.");

    const disciplinas = await this.repo.listDisciplinasByPeriodo(usuarioId, periodoId);
    const itens = await Promise.all(
      disciplinas.map(async (d) => {
        const avaliacoes = await this.repo.listAvaliacoesByDisciplina(usuarioId, d.id);
        const desempenho = calcularDesempenho(toCalculoInput(d, avaliacoes));
        return {
          ...d,
          totalAvaliacoes: avaliacoes.length,
          situacao: desempenho.situacao,
          desempenho,
        };
      })
    );

    return { itens };
  }

  /** E16 — Criar disciplina com padrões CA05.1 */
  async create(usuarioId: string, periodoId: string, input: CreateDisciplinaInput) {
    const periodo = await this.repo.findPeriodoById(usuarioId, periodoId);
    if (!periodo) throw notFoundError("Período letivo não encontrado.");

    const total = await this.repo.countDisciplinasByPeriodo(usuarioId, periodoId);
    if (total >= MAX_DISCIPLINAS_POR_PERIODO) {
      throw new DomainError({
        status: 422,
        code: "LIMITE_ATINGIDO",
        title: "Limite de disciplinas atingido",
        detail: `Um período pode conter no máximo ${MAX_DISCIPLINAS_POR_PERIODO} disciplinas.`,
      });
    }

    const criada = await this.repo.createDisciplina(usuarioId, periodoId, {
      nome: input.nome,
      codigo: input.codigo ?? null,
      metodoCalculo: input.metodoCalculo,
      notaMinimaAprovacao: input.notaMinimaAprovacao,
      casasDecimais: input.casasDecimais,
      permiteSubstitutiva: input.permiteSubstitutiva,
      permiteExameFinal: input.permiteExameFinal,
      notaMinimaExame: input.notaMinimaExame,
      mediaAprovacaoExame: input.mediaAprovacaoExame,
    });

    const desempenho = calcularDesempenho(toCalculoInput(criada, []));
    return {
      ...criada,
      avaliacoes: [],
      desempenho,
    };
  }

  /** E17 — Detalhar disciplina com avaliações e desempenho calculado */
  async getById(usuarioId: string, disciplinaId: string) {
    const disciplina = await this.repo.findDisciplinaById(usuarioId, disciplinaId);
    if (!disciplina) throw notFoundError("Disciplina não encontrada.");

    const avaliacoes = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplinaId);
    const desempenho = calcularDesempenho(toCalculoInput(disciplina, avaliacoes));

    return {
      ...disciplina,
      avaliacoes,
      desempenho,
    };
  }

  /** E30 — Prévia de alteração de critérios sem persistir (RF07 / CA07.1) */
  async previewCriteria(
    usuarioId: string,
    disciplinaId: string,
    input: PreviaCriteriosInput
  ) {
    const disciplina = await this.repo.findDisciplinaById(usuarioId, disciplinaId);
    if (!disciplina) throw notFoundError("Disciplina não encontrada.");

    const avaliacoes = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplinaId);
    const desempenhoAtual = calcularDesempenho(toCalculoInput(disciplina, avaliacoes));

    const pesosMap = new Map((input.pesos ?? []).map((p) => [p.avaliacaoId, p.peso]));
    const avaliacoesNovas = avaliacoes.map((a) =>
      pesosMap.has(a.id) ? { ...a, peso: pesosMap.get(a.id)! } : a
    );

    const novaDisciplina: DisciplinaRecord = {
      ...disciplina,
      metodoCalculo: input.metodoCalculo ?? disciplina.metodoCalculo,
      notaMinimaAprovacao: input.notaMinimaAprovacao ?? disciplina.notaMinimaAprovacao,
      casasDecimais: input.casasDecimais ?? disciplina.casasDecimais,
      permiteSubstitutiva: input.permiteSubstitutiva ?? disciplina.permiteSubstitutiva,
      permiteExameFinal: input.permiteExameFinal ?? disciplina.permiteExameFinal,
      notaMinimaExame: input.notaMinimaExame ?? disciplina.notaMinimaExame,
      mediaAprovacaoExame: input.mediaAprovacaoExame ?? disciplina.mediaAprovacaoExame,
    };

    const desempenhoNovo = calcularDesempenho(toCalculoInput(novaDisciplina, avaliacoesNovas));

    return { desempenhoAtual, desempenhoNovo };
  }

  /** E18 — Atualizar disciplina (RN12: exige confirmação quando muda critérios com notas) */
  async update(usuarioId: string, disciplinaId: string, input: UpdateDisciplinaInput) {
    const existing = await this.repo.findDisciplinaById(usuarioId, disciplinaId);
    if (!existing) throw notFoundError("Disciplina não encontrada.");

    const avaliacoes = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplinaId);
    const temNotas =
      avaliacoes.some((a) => a.nota !== null) ||
      existing.notaSubstitutiva !== null ||
      existing.notaExame !== null;

    const alteraCriterio =
      (input.metodoCalculo !== undefined && input.metodoCalculo !== existing.metodoCalculo) ||
      (input.notaMinimaAprovacao !== undefined &&
        input.notaMinimaAprovacao !== existing.notaMinimaAprovacao) ||
      (input.casasDecimais !== undefined && input.casasDecimais !== existing.casasDecimais) ||
      (input.permiteSubstitutiva !== undefined &&
        input.permiteSubstitutiva !== existing.permiteSubstitutiva) ||
      (input.permiteExameFinal !== undefined &&
        input.permiteExameFinal !== existing.permiteExameFinal) ||
      (input.notaMinimaExame !== undefined && input.notaMinimaExame !== existing.notaMinimaExame) ||
      (input.mediaAprovacaoExame !== undefined &&
        input.mediaAprovacaoExame !== existing.mediaAprovacaoExame);

    const notaMinAprov = input.notaMinimaAprovacao ?? existing.notaMinimaAprovacao;
    const notaMinExame = input.notaMinimaExame ?? existing.notaMinimaExame;
    if (notaMinExame > notaMinAprov) {
      throw new DomainError({
        status: 422,
        code: "VALIDACAO",
        title: "Critérios inválidos",
        detail: "A nota mínima para exame não pode exceder a nota mínima de aprovação.",
      });
    }

    if (temNotas && alteraCriterio && !input.confirmar) {
      const previa = await this.previewCriteria(usuarioId, disciplinaId, input);
      throw new DomainError({
        status: 409,
        code: "CONFIRMACAO_NECESSARIA",
        title: "Confirmação necessária para alterar critérios",
        detail:
          "Esta disciplina já possui notas lançadas. Confirme a alteração para recalcular o desempenho.",
        extra: previa,
      });
    }

    const atualizada = await this.repo.updateDisciplina(usuarioId, disciplinaId, input.versao, {
      ...(input.nome !== undefined ? { nome: input.nome } : {}),
      ...(input.codigo !== undefined ? { codigo: input.codigo } : {}),
      ...(input.metodoCalculo !== undefined ? { metodoCalculo: input.metodoCalculo } : {}),
      ...(input.notaMinimaAprovacao !== undefined
        ? { notaMinimaAprovacao: input.notaMinimaAprovacao }
        : {}),
      ...(input.casasDecimais !== undefined ? { casasDecimais: input.casasDecimais } : {}),
      ...(input.permiteSubstitutiva !== undefined
        ? { permiteSubstitutiva: input.permiteSubstitutiva }
        : {}),
      ...(input.permiteExameFinal !== undefined
        ? { permiteExameFinal: input.permiteExameFinal }
        : {}),
      ...(input.notaMinimaExame !== undefined ? { notaMinimaExame: input.notaMinimaExame } : {}),
      ...(input.mediaAprovacaoExame !== undefined
        ? { mediaAprovacaoExame: input.mediaAprovacaoExame }
        : {}),
    });

    if (alteraCriterio) {
      await this.repo.appendAuditoria({
        usuarioId,
        tipo: "DISCIPLINA_CRITERIO_ALTERADO",
        metadados: {
          disciplinaId,
          antes: {
            metodoCalculo: existing.metodoCalculo,
            notaMinimaAprovacao: existing.notaMinimaAprovacao,
            casasDecimais: existing.casasDecimais,
          },
          depois: {
            metodoCalculo: atualizada.metodoCalculo,
            notaMinimaAprovacao: atualizada.notaMinimaAprovacao,
            casasDecimais: atualizada.casasDecimais,
          },
        },
      });
    }

    const desempenho = calcularDesempenho(toCalculoInput(atualizada, avaliacoes));
    return {
      ...atualizada,
      avaliacoes,
      desempenho,
    };
  }

  /** E19 — Excluir disciplina */
  async delete(usuarioId: string, disciplinaId: string, confirmar: boolean) {
    const existing = await this.repo.findDisciplinaById(usuarioId, disciplinaId);
    if (!existing) throw notFoundError("Disciplina não encontrada.");

    const avaliacoes = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplinaId);
    const notasLancadas = avaliacoes.filter((a) => a.nota !== null).length;

    if (notasLancadas > 0 && !confirmar) {
      throw new DomainError({
        status: 409,
        code: "CONFIRMACAO_NECESSARIA",
        title: "Confirmação necessária",
        detail: `Esta disciplina possui ${notasLancadas} nota(s) lançada(s). Confirme para excluir.`,
        extra: { impacto: { avaliacoes: avaliacoes.length, notasLancadas } },
      });
    }

    await this.repo.deleteDisciplinaCascade(usuarioId, disciplinaId);
  }
}
