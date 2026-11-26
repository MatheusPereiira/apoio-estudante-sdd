import {
  DomainError,
  notFoundError,
  type CreateAvaliacaoInput,
  type LancarNotaInput,
  type UpdateAvaliacaoInput,
} from "@app/contracts";
import { calcularDesempenho } from "@app/domain";
import { toCalculoInput } from "./disciplina-service.js";
import type { AppRepositoryPort } from "./ports.js";

const MAX_AVALIACOES_POR_DISCIPLINA = 20;

export class AvaliacaoService {
  constructor(private readonly repo: AppRepositoryPort) {}

  /** E20 — Criar avaliação com validação de soma de pesos <= 100 (RN03 / CA06.2) */
  async create(usuarioId: string, disciplinaId: string, input: CreateAvaliacaoInput) {
    const disciplina = await this.repo.findDisciplinaById(usuarioId, disciplinaId);
    if (!disciplina) throw notFoundError("Disciplina não encontrada.");

    const existentes = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplinaId);
    if (existentes.length >= MAX_AVALIACOES_POR_DISCIPLINA) {
      throw new DomainError({
        status: 422,
        code: "LIMITE_ATINGIDO",
        title: "Limite de avaliações atingido",
        detail: `Uma disciplina pode ter no máximo ${MAX_AVALIACOES_POR_DISCIPLINA} avaliações regulares.`,
      });
    }

    const pesoInformado =
      input.peso !== undefined
        ? input.peso
        : disciplina.metodoCalculo === "SIMPLES"
          ? Number((100 / (existentes.length + 1)).toFixed(2))
          : undefined;

    if (pesoInformado === undefined) {
      throw new DomainError({
        status: 422,
        code: "VALIDACAO",
        title: "Peso obrigatório",
        detail: "Informe o peso (%) da avaliação para disciplinas no método PONDERADA.",
      });
    }

    if (disciplina.metodoCalculo === "PONDERADA") {
      const somaAtual = Number(
        existentes.reduce((acc, a) => acc + Math.round(a.peso * 100), 0) / 100
      );
      const novaSomaCentesimos =
        existentes.reduce((acc, a) => acc + Math.round(a.peso * 100), 0) +
        Math.round(pesoInformado * 100);
      if (novaSomaCentesimos > 10000) {
        const disponivel = Number(((10000 - Math.round(somaAtual * 100)) / 100).toFixed(2));
        throw new DomainError({
          status: 422,
          code: "SOMA_PESOS_EXCEDIDA",
          title: "Soma de pesos excede 100%",
          detail: `Restam ${disponivel} pontos percentuais disponíveis.`,
          extra: { somaAtual, disponivel },
        });
      }
    }

    const avaliacao = await this.repo.createAvaliacao(usuarioId, disciplinaId, {
      nome: input.nome,
      peso: pesoInformado,
      elegivelSubstitutiva: input.elegivelSubstitutiva,
      dataPrevista: input.dataPrevista ?? null,
      ordem: existentes.length,
    });

    const todas = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplinaId);
    const desempenho = calcularDesempenho(toCalculoInput(disciplina, todas));
    return { avaliacao, desempenho };
  }

  /** E21 — Editar avaliação (RN03, RN12, RN16) */
  async update(usuarioId: string, avaliacaoId: string, input: UpdateAvaliacaoInput) {
    const existing = await this.repo.findAvaliacaoById(usuarioId, avaliacaoId);
    if (!existing) throw notFoundError("Avaliação não encontrada.");

    const disciplina = await this.repo.findDisciplinaById(usuarioId, existing.disciplinaId);
    if (!disciplina) throw notFoundError("Disciplina não encontrada.");

    const todas = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplina.id);
    const temNotas = todas.some((a) => a.nota !== null);

    if (
      input.peso !== undefined &&
      input.peso !== existing.peso &&
      temNotas &&
      !input.confirmar
    ) {
      throw new DomainError({
        status: 409,
        code: "CONFIRMACAO_NECESSARIA",
        title: "Confirmação necessária",
        detail: "Alterar o peso com notas já lançadas exige confirmação explícita.",
      });
    }

    if (input.peso !== undefined && disciplina.metodoCalculo === "PONDERADA") {
      const somaOutrasCentesimos = todas
        .filter((a) => a.id !== existing.id)
        .reduce((acc, a) => acc + Math.round(a.peso * 100), 0);
      if (somaOutrasCentesimos + Math.round(input.peso * 100) > 10000) {
        const somaAtual = Number((somaOutrasCentesimos / 100).toFixed(2));
        const disponivel = Number(((10000 - somaOutrasCentesimos) / 100).toFixed(2));
        throw new DomainError({
          status: 422,
          code: "SOMA_PESOS_EXCEDIDA",
          title: "Soma de pesos excede 100%",
          detail: `Restam ${disponivel} pontos percentuais disponíveis.`,
          extra: { somaAtual, disponivel },
        });
      }
    }

    const atualizada = await this.repo.updateAvaliacao(usuarioId, avaliacaoId, input.versao, {
      ...(input.nome !== undefined ? { nome: input.nome } : {}),
      ...(input.peso !== undefined ? { peso: input.peso } : {}),
      ...(input.elegivelSubstitutiva !== undefined
        ? { elegivelSubstitutiva: input.elegivelSubstitutiva }
        : {}),
      ...(input.dataPrevista !== undefined ? { dataPrevista: input.dataPrevista } : {}),
    });

    const atualizadas = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplina.id);
    const desempenho = calcularDesempenho(toCalculoInput(disciplina, atualizadas));
    return { avaliacao: atualizada, desempenho };
  }

  /** E22 — Excluir avaliação (CA06.4) */
  async delete(usuarioId: string, avaliacaoId: string, confirmar: boolean) {
    const existing = await this.repo.findAvaliacaoById(usuarioId, avaliacaoId);
    if (!existing) throw notFoundError("Avaliação não encontrada.");

    const disciplina = await this.repo.findDisciplinaById(usuarioId, existing.disciplinaId);
    if (!disciplina) throw notFoundError("Disciplina não encontrada.");

    if (existing.nota !== null && !confirmar) {
      throw new DomainError({
        status: 409,
        code: "CONFIRMACAO_NECESSARIA",
        title: "Confirmação necessária",
        detail: "Esta avaliação possui nota lançada. Confirme para excluí-la.",
      });
    }

    await this.repo.deleteAvaliacao(usuarioId, avaliacaoId);
    await this.repo.appendAuditoria({
      usuarioId,
      tipo: "AVALIACAO_EXCLUIDA",
      metadados: { disciplinaId: disciplina.id, avaliacaoId, tinhaNota: existing.nota !== null },
    });

    const restantes = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplina.id);
    const desempenho = calcularDesempenho(toCalculoInput(disciplina, restantes));
    return { desempenho };
  }

  /** E23 — Reordenar avaliações */
  async reorder(usuarioId: string, disciplinaId: string, ordemIds: string[]) {
    const disciplina = await this.repo.findDisciplinaById(usuarioId, disciplinaId);
    if (!disciplina) throw notFoundError("Disciplina não encontrada.");

    const existentes = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplinaId);
    const idsExistentes = new Set(existentes.map((a) => a.id));
    if (
      ordemIds.length !== existentes.length ||
      new Set(ordemIds).size !== existentes.length ||
      ordemIds.some((id) => !idsExistentes.has(id))
    ) {
      throw new DomainError({
        status: 422,
        code: "VALIDACAO",
        title: "Lista de ordenação inválida",
        detail: "Informe exatamente todos os IDs das avaliações desta disciplina.",
      });
    }

    await this.repo.reorderAvaliacoes(usuarioId, disciplinaId, ordemIds);
  }

  /** E24 — Lançar ou alterar nota regular com histórico imutável (RF08, RF11 / CA08.1) */
  async setNota(usuarioId: string, avaliacaoId: string, input: LancarNotaInput) {
    const existing = await this.repo.findAvaliacaoById(usuarioId, avaliacaoId);
    if (!existing) throw notFoundError("Avaliação não encontrada.");

    const disciplina = await this.repo.findDisciplinaById(usuarioId, existing.disciplinaId);
    if (!disciplina) throw notFoundError("Disciplina não encontrada.");

    // Idempotência: mesma nota sem criar novo histórico (api-spec.md E24)
    if (existing.nota !== null && existing.nota === input.nota && existing.versao === input.versao) {
      const todas = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplina.id);
      return {
        avaliacao: existing,
        historico: null,
        desempenho: calcularDesempenho(toCalculoInput(disciplina, todas)),
      };
    }

    const acao = existing.nota === null ? "LANCADA" : "ALTERADA";
    const atualizada = await this.repo.updateAvaliacao(usuarioId, avaliacaoId, input.versao, {
      nota: input.nota,
      notaLancadaEm: new Date().toISOString(),
    });

    const historico = await this.repo.appendHistoricoNota(usuarioId, {
      disciplinaId: disciplina.id,
      avaliacaoId: existing.id,
      tipoAlvo: "REGULAR",
      acao,
      notaAnterior: existing.nota,
      notaNova: input.nota,
    });

    const todas = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplina.id);
    const desempenho = calcularDesempenho(toCalculoInput(disciplina, todas));
    return { avaliacao: atualizada, historico, desempenho };
  }

  /** E25 — Remover nota regular (volta a pendente, NÃO vira zero — CA08.3 / RN05) */
  async removeNota(usuarioId: string, avaliacaoId: string, versao: number) {
    const existing = await this.repo.findAvaliacaoById(usuarioId, avaliacaoId);
    if (!existing) throw notFoundError("Avaliação não encontrada.");

    if (existing.nota === null) {
      throw new DomainError({
        status: 422,
        code: "NOTA_INEXISTENTE",
        title: "Nota inexistente",
        detail: "Esta avaliação já está pendente.",
      });
    }

    const disciplina = await this.repo.findDisciplinaById(usuarioId, existing.disciplinaId);
    if (!disciplina) throw notFoundError("Disciplina não encontrada.");

    const atualizada = await this.repo.updateAvaliacao(usuarioId, avaliacaoId, versao, {
      nota: null,
      notaLancadaEm: null,
    });

    const historico = await this.repo.appendHistoricoNota(usuarioId, {
      disciplinaId: disciplina.id,
      avaliacaoId: existing.id,
      tipoAlvo: "REGULAR",
      acao: "REMOVIDA",
      notaAnterior: existing.nota,
      notaNova: null,
    });

    const todas = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplina.id);
    const desempenho = calcularDesempenho(toCalculoInput(disciplina, todas));
    return { avaliacao: atualizada, historico, desempenho };
  }

  /** E26 — Histórico imutável de alterações de nota (RF11) */
  async listHistorico(usuarioId: string, avaliacaoId: string, limite = 20) {
    const existing = await this.repo.findAvaliacaoById(usuarioId, avaliacaoId);
    if (!existing) throw notFoundError("Avaliação não encontrada.");

    const lim = Math.min(Math.max(1, limite), 100);
    const itens = await this.repo.listHistoricoByAvaliacao(usuarioId, avaliacaoId, lim);
    return { itens, proximoCursor: null };
  }

  /** E32 — Lançar/alterar Prova Substitutiva (RN19) */
  async setSubstitutiva(usuarioId: string, disciplinaId: string, input: LancarNotaInput) {
    const disciplina = await this.repo.findDisciplinaById(usuarioId, disciplinaId);
    if (!disciplina) throw notFoundError("Disciplina não encontrada.");

    if (!disciplina.permiteSubstitutiva) {
      throw new DomainError({
        status: 422,
        code: "SUBSTITUTIVA_DESABILITADA",
        title: "Prova Substitutiva desabilitada",
        detail: "Esta disciplina não permite Prova Substitutiva.",
      });
    }

    const avaliacoes = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplinaId);
    if (avaliacoes.length === 0 || avaliacoes.some((a) => a.nota === null)) {
      throw new DomainError({
        status: 422,
        code: "AVALIACOES_REGULARES_PENDENTES",
        title: "Avaliações regulares pendentes",
        detail: "Lance todas as avaliações regulares antes de registrar a Prova Substitutiva.",
      });
    }

    const acao = disciplina.notaSubstitutiva === null ? "LANCADA" : "ALTERADA";
    const agora = new Date().toISOString();
    const atualizada = await this.repo.updateDisciplina(usuarioId, disciplinaId, input.versao, {
      notaSubstitutiva: input.nota,
      notaSubstitutivaEm: agora,
    });

    const historico = await this.repo.appendHistoricoNota(usuarioId, {
      disciplinaId,
      avaliacaoId: null,
      tipoAlvo: "SUBSTITUTIVA",
      acao,
      notaAnterior: disciplina.notaSubstitutiva,
      notaNova: input.nota,
    });

    const desempenho = calcularDesempenho(toCalculoInput(atualizada, avaliacoes));
    return {
      disciplinaId,
      notaSubstitutiva: atualizada.notaSubstitutiva,
      notaSubstitutivaEm: atualizada.notaSubstitutivaEm,
      avaliacaoSubstituidaId: desempenho.substitutiva.avaliacaoSubstituidaId,
      versao: atualizada.versao,
      historico,
      desempenho,
    };
  }

  /** E33 — Remover Prova Substitutiva */
  async removeSubstitutiva(usuarioId: string, disciplinaId: string, versao: number) {
    const disciplina = await this.repo.findDisciplinaById(usuarioId, disciplinaId);
    if (!disciplina) throw notFoundError("Disciplina não encontrada.");

    if (disciplina.notaSubstitutiva === null) {
      throw new DomainError({
        status: 422,
        code: "NOTA_INEXISTENTE",
        title: "Substitutiva não lançada",
        detail: "Não há nota de Prova Substitutiva para remover.",
      });
    }

    const atualizada = await this.repo.updateDisciplina(usuarioId, disciplinaId, versao, {
      notaSubstitutiva: null,
      notaSubstitutivaEm: null,
    });

    const historico = await this.repo.appendHistoricoNota(usuarioId, {
      disciplinaId,
      avaliacaoId: null,
      tipoAlvo: "SUBSTITUTIVA",
      acao: "REMOVIDA",
      notaAnterior: disciplina.notaSubstitutiva,
      notaNova: null,
    });

    const avaliacoes = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplinaId);
    const desempenho = calcularDesempenho(toCalculoInput(atualizada, avaliacoes));
    return {
      notaSubstitutiva: null,
      versao: atualizada.versao,
      historico,
      desempenho,
    };
  }

  /** E34 — Lançar/alterar Exame Final (RN20 / RN21) */
  async setExameFinal(usuarioId: string, disciplinaId: string, input: LancarNotaInput) {
    const disciplina = await this.repo.findDisciplinaById(usuarioId, disciplinaId);
    if (!disciplina) throw notFoundError("Disciplina não encontrada.");

    const avaliacoes = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplinaId);
    const desempenhoAtual = calcularDesempenho(toCalculoInput(disciplina, avaliacoes));

    if (!disciplina.permiteExameFinal || !desempenhoAtual.exameFinal.elegivel) {
      throw new DomainError({
        status: 422,
        code: "EXAME_NAO_ELEGIVEL",
        title: "Exame Final não elegível",
        detail: "A disciplina não está na faixa elegível para lançamento de Exame Final.",
      });
    }

    const acao = disciplina.notaExame === null ? "LANCADA" : "ALTERADA";
    const agora = new Date().toISOString();
    const atualizada = await this.repo.updateDisciplina(usuarioId, disciplinaId, input.versao, {
      notaExame: input.nota,
      notaExameEm: agora,
    });

    const historico = await this.repo.appendHistoricoNota(usuarioId, {
      disciplinaId,
      avaliacaoId: null,
      tipoAlvo: "EXAME_FINAL",
      acao,
      notaAnterior: disciplina.notaExame,
      notaNova: input.nota,
    });

    const desempenho = calcularDesempenho(toCalculoInput(atualizada, avaliacoes));
    return {
      disciplinaId,
      notaExame: atualizada.notaExame,
      notaExameEm: atualizada.notaExameEm,
      versao: atualizada.versao,
      historico,
      desempenho,
    };
  }

  /** E35 — Remover Exame Final */
  async removeExameFinal(usuarioId: string, disciplinaId: string, versao: number) {
    const disciplina = await this.repo.findDisciplinaById(usuarioId, disciplinaId);
    if (!disciplina) throw notFoundError("Disciplina não encontrada.");

    if (disciplina.notaExame === null) {
      throw new DomainError({
        status: 422,
        code: "NOTA_INEXISTENTE",
        title: "Exame Final não lançado",
        detail: "Não há nota de Exame Final para remover.",
      });
    }

    const atualizada = await this.repo.updateDisciplina(usuarioId, disciplinaId, versao, {
      notaExame: null,
      notaExameEm: null,
    });

    const historico = await this.repo.appendHistoricoNota(usuarioId, {
      disciplinaId,
      avaliacaoId: null,
      tipoAlvo: "EXAME_FINAL",
      acao: "REMOVIDA",
      notaAnterior: disciplina.notaExame,
      notaNova: null,
    });

    const avaliacoes = await this.repo.listAvaliacoesByDisciplina(usuarioId, disciplinaId);
    const desempenho = calcularDesempenho(toCalculoInput(atualizada, avaliacoes));
    return {
      notaExame: null,
      versao: atualizada.versao,
      historico,
      desempenho,
    };
  }
}
