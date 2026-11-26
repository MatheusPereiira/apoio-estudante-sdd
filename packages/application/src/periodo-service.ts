import {
  DomainError,
  notFoundError,
  type CreatePeriodoInput,
  type UpdatePeriodoInput,
} from "@app/contracts";
import type { AppRepositoryPort } from "./ports.js";

const MAX_PERIODOS_POR_ESTUDANTE = 20;

export class PeriodoService {
  constructor(private readonly repo: AppRepositoryPort) {}

  /** E10 — Listar períodos ordenados do mais recente ao mais antigo (CA04.1) */
  async list(usuarioId: string) {
    const periodos = await this.repo.listPeriodos(usuarioId);
    const itens = await Promise.all(
      periodos.map(async (p) => {
        const totalDisciplinas = await this.repo.countDisciplinasByPeriodo(usuarioId, p.id);
        return {
          ...p,
          totalDisciplinas,
        };
      })
    );

    itens.sort((a, b) => {
      if (a.dataInicio && b.dataInicio && a.dataInicio !== b.dataInicio) {
        return b.dataInicio.localeCompare(a.dataInicio);
      }
      if (a.dataInicio && !b.dataInicio) return -1;
      if (!a.dataInicio && b.dataInicio) return 1;
      return b.criadoEm.localeCompare(a.criadoEm);
    });

    return { itens };
  }

  /** E11 — Criar período letivo (RF04, RN14, RN15) */
  async create(usuarioId: string, input: CreatePeriodoInput) {
    const total = await this.repo.countPeriodos(usuarioId);
    if (total >= MAX_PERIODOS_POR_ESTUDANTE) {
      throw new DomainError({
        status: 422,
        code: "LIMITE_ATINGIDO",
        title: "Limite de períodos atingido",
        detail: `Você pode cadastrar no máximo ${MAX_PERIODOS_POR_ESTUDANTE} períodos letivos.`,
      });
    }

    const criado = await this.repo.createPeriodo(usuarioId, {
      nome: input.nome,
      dataInicio: input.dataInicio ?? null,
      dataFim: input.dataFim ?? null,
    });

    return { ...criado, totalDisciplinas: 0 };
  }

  /** E12 — Detalhar período */
  async getById(usuarioId: string, periodoId: string) {
    const periodo = await this.repo.findPeriodoById(usuarioId, periodoId);
    if (!periodo) throw notFoundError("Período letivo não encontrado.");
    const totalDisciplinas = await this.repo.countDisciplinasByPeriodo(usuarioId, periodoId);
    return { ...periodo, totalDisciplinas };
  }

  /** E13 — Atualizar período com controle otimista de versão (RN16) */
  async update(usuarioId: string, periodoId: string, input: UpdatePeriodoInput) {
    const existing = await this.repo.findPeriodoById(usuarioId, periodoId);
    if (!existing) throw notFoundError("Período letivo não encontrado.");

    const dataInicioFinal =
      input.dataInicio !== undefined ? input.dataInicio : existing.dataInicio;
    const dataFimFinal = input.dataFim !== undefined ? input.dataFim : existing.dataFim;
    if (dataInicioFinal && dataFimFinal && dataFimFinal < dataInicioFinal) {
      throw new DomainError({
        status: 422,
        code: "VALIDACAO",
        title: "Datas inválidas",
        detail: "A data de fim não pode ser anterior à data de início.",
      });
    }

    return this.repo.updatePeriodo(usuarioId, periodoId, input.versao, {
      ...(input.nome !== undefined ? { nome: input.nome } : {}),
      ...(input.dataInicio !== undefined ? { dataInicio: input.dataInicio } : {}),
      ...(input.dataFim !== undefined ? { dataFim: input.dataFim } : {}),
    });
  }

  /** E14 — Excluir período com confirmação de impacto (CA04.4) */
  async delete(usuarioId: string, periodoId: string, confirmar: boolean) {
    const existing = await this.repo.findPeriodoById(usuarioId, periodoId);
    if (!existing) throw notFoundError("Período letivo não encontrado.");

    const disciplinas = await this.repo.listDisciplinasByPeriodo(usuarioId, periodoId);
    const avaliacoes = await this.repo.listAvaliacoesByPeriodo(usuarioId, periodoId);
    const notasLancadas = avaliacoes.filter((a) => a.nota !== null).length;

    if (disciplinas.length > 0 && !confirmar) {
      throw new DomainError({
        status: 409,
        code: "CONFIRMACAO_NECESSARIA",
        title: "Confirmação necessária",
        detail: `Este período possui ${disciplinas.length} disciplina(s) e ${notasLancadas} nota(s) lançada(s). Confirme para excluir tudo.`,
        extra: {
          impacto: {
            disciplinas: disciplinas.length,
            avaliacoes: avaliacoes.length,
            notasLancadas,
          },
        },
      });
    }

    await this.repo.deletePeriodoCascade(usuarioId, periodoId);
    await this.repo.appendAuditoria({
      usuarioId,
      tipo: "PERIODO_EXCLUIDO",
      metadados: { periodoId, disciplinasRemovidas: disciplinas.length },
    });
  }
}
