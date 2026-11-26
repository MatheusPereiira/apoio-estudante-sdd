import { PrismaClient } from "@prisma/client";
import type {
  AppRepositoryPort,
  AvaliacaoRecord,
  DisciplinaRecord,
  EventoAuditoriaRecord,
  HistoricoNotaRecord,
  PeriodoRecord,
  SessaoRecord,
  UsuarioRecord,
} from "@app/application";
import { duplicateNameError, notFoundError, versionConflictError } from "@app/contracts";
import type { CasasDecimais, MetodoCalculo } from "@app/domain";

function toDateOnly(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toNum(v: unknown): number {
  return Number(String(v));
}

function toNullableNum(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(String(v));
}

function mapPrismaError(err: unknown, entidade: string): never {
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  ) {
    throw duplicateNameError(entidade);
  }
  throw err;
}

/**
 * Adaptador PostgreSQL 16 (Prisma) — toda consulta acadêmica filtra estritamente por `usuarioId` (RN01 / C3).
 */
export class PrismaAppRepository implements AppRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async ping(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async findUsuarioByEmail(email: string): Promise<UsuarioRecord | null> {
    const u = await this.prisma.usuario.findUnique({ where: { email: email.toLowerCase() } });
    if (!u) return null;
    return {
      id: u.id,
      nome: u.nome,
      email: u.email,
      senhaHash: u.senhaHash,
      termosVersao: u.termosVersao,
      termosAceitosEm: u.termosAceitosEm.toISOString(),
      tentativasFalhas: u.tentativasFalhas,
      bloqueadoAte: u.bloqueadoAte?.toISOString() ?? null,
      criadoEm: u.criadoEm.toISOString(),
      atualizadoEm: u.atualizadoEm.toISOString(),
    };
  }

  async findUsuarioById(usuarioId: string): Promise<UsuarioRecord | null> {
    const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!u) return null;
    return {
      id: u.id,
      nome: u.nome,
      email: u.email,
      senhaHash: u.senhaHash,
      termosVersao: u.termosVersao,
      termosAceitosEm: u.termosAceitosEm.toISOString(),
      tentativasFalhas: u.tentativasFalhas,
      bloqueadoAte: u.bloqueadoAte?.toISOString() ?? null,
      criadoEm: u.criadoEm.toISOString(),
      atualizadoEm: u.atualizadoEm.toISOString(),
    };
  }

  async createUsuario(data: {
    nome: string;
    email: string;
    senhaHash: string;
    termosVersao: string;
  }): Promise<UsuarioRecord> {
    const u = await this.prisma.usuario.create({
      data: {
        nome: data.nome,
        email: data.email.toLowerCase(),
        senhaHash: data.senhaHash,
        termosVersao: data.termosVersao,
      },
    });
    return {
      id: u.id,
      nome: u.nome,
      email: u.email,
      senhaHash: u.senhaHash,
      termosVersao: u.termosVersao,
      termosAceitosEm: u.termosAceitosEm.toISOString(),
      tentativasFalhas: u.tentativasFalhas,
      bloqueadoAte: u.bloqueadoAte?.toISOString() ?? null,
      criadoEm: u.criadoEm.toISOString(),
      atualizadoEm: u.atualizadoEm.toISOString(),
    };
  }

  async updateUsuario(
    usuarioId: string,
    patch: Partial<Pick<UsuarioRecord, "nome" | "tentativasFalhas" | "bloqueadoAte">>
  ): Promise<UsuarioRecord | null> {
    const u = await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        ...(patch.nome !== undefined ? { nome: patch.nome } : {}),
        ...(patch.tentativasFalhas !== undefined
          ? { tentativasFalhas: patch.tentativasFalhas }
          : {}),
        ...(patch.bloqueadoAte !== undefined
          ? { bloqueadoAte: patch.bloqueadoAte ? new Date(patch.bloqueadoAte) : null }
          : {}),
      },
    });
    return {
      id: u.id,
      nome: u.nome,
      email: u.email,
      senhaHash: u.senhaHash,
      termosVersao: u.termosVersao,
      termosAceitosEm: u.termosAceitosEm.toISOString(),
      tentativasFalhas: u.tentativasFalhas,
      bloqueadoAte: u.bloqueadoAte?.toISOString() ?? null,
      criadoEm: u.criadoEm.toISOString(),
      atualizadoEm: u.atualizadoEm.toISOString(),
    };
  }

  async deleteUsuarioCascade(usuarioId: string): Promise<void> {
    await this.prisma.usuario.delete({ where: { id: usuarioId } });
  }

  async createSessao(data: {
    usuarioId: string;
    familiaId: string;
    refreshTokenHash: string;
    userAgent: string | null;
    ipHash: string | null;
    expiraEm: string;
  }): Promise<SessaoRecord> {
    const s = await this.prisma.sessao.create({
      data: {
        usuarioId: data.usuarioId,
        familiaId: data.familiaId,
        refreshTokenHash: data.refreshTokenHash,
        userAgent: data.userAgent,
        ipHash: data.ipHash,
        expiraEm: new Date(data.expiraEm),
      },
    });
    return {
      id: s.id,
      usuarioId: s.usuarioId,
      familiaId: s.familiaId,
      refreshTokenHash: s.refreshTokenHash,
      userAgent: s.userAgent,
      ipHash: s.ipHash,
      expiraEm: s.expiraEm.toISOString(),
      revogadaEm: s.revogadaEm?.toISOString() ?? null,
      criadoEm: s.criadoEm.toISOString(),
    };
  }

  async findSessaoByRefreshHash(refreshTokenHash: string): Promise<SessaoRecord | null> {
    const s = await this.prisma.sessao.findUnique({ where: { refreshTokenHash } });
    if (!s) return null;
    return {
      id: s.id,
      usuarioId: s.usuarioId,
      familiaId: s.familiaId,
      refreshTokenHash: s.refreshTokenHash,
      userAgent: s.userAgent,
      ipHash: s.ipHash,
      expiraEm: s.expiraEm.toISOString(),
      revogadaEm: s.revogadaEm?.toISOString() ?? null,
      criadoEm: s.criadoEm.toISOString(),
    };
  }

  async revokeSessao(sessaoId: string): Promise<void> {
    await this.prisma.sessao.updateMany({
      where: { id: sessaoId, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
  }

  async revokeFamiliaSessoes(familiaId: string): Promise<void> {
    await this.prisma.sessao.updateMany({
      where: { familiaId, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
  }

  async revokeAllSessoesUsuario(usuarioId: string): Promise<void> {
    await this.prisma.sessao.updateMany({
      where: { usuarioId, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
  }

  async listPeriodos(usuarioId: string): Promise<PeriodoRecord[]> {
    const rows = await this.prisma.periodoLetivo.findMany({ where: { usuarioId } });
    return rows.map((p) => ({
      id: p.id,
      usuarioId: p.usuarioId,
      nome: p.nome,
      dataInicio: toDateOnly(p.dataInicio),
      dataFim: toDateOnly(p.dataFim),
      versao: p.versao,
      criadoEm: p.criadoEm.toISOString(),
      atualizadoEm: p.atualizadoEm.toISOString(),
    }));
  }

  async findPeriodoById(usuarioId: string, periodoId: string): Promise<PeriodoRecord | null> {
    const p = await this.prisma.periodoLetivo.findFirst({ where: { id: periodoId, usuarioId } });
    if (!p) return null;
    return {
      id: p.id,
      usuarioId: p.usuarioId,
      nome: p.nome,
      dataInicio: toDateOnly(p.dataInicio),
      dataFim: toDateOnly(p.dataFim),
      versao: p.versao,
      criadoEm: p.criadoEm.toISOString(),
      atualizadoEm: p.atualizadoEm.toISOString(),
    };
  }

  async countPeriodos(usuarioId: string): Promise<number> {
    return this.prisma.periodoLetivo.count({ where: { usuarioId } });
  }

  async createPeriodo(
    usuarioId: string,
    data: { nome: string; dataInicio: string | null; dataFim: string | null }
  ): Promise<PeriodoRecord> {
    try {
      const p = await this.prisma.periodoLetivo.create({
        data: {
          usuarioId,
          nome: data.nome,
          dataInicio: data.dataInicio ? new Date(data.dataInicio) : null,
          dataFim: data.dataFim ? new Date(data.dataFim) : null,
        },
      });
      return {
        id: p.id,
        usuarioId: p.usuarioId,
        nome: p.nome,
        dataInicio: toDateOnly(p.dataInicio),
        dataFim: toDateOnly(p.dataFim),
        versao: p.versao,
        criadoEm: p.criadoEm.toISOString(),
        atualizadoEm: p.atualizadoEm.toISOString(),
      };
    } catch (err) {
      mapPrismaError(err, "um período letivo");
    }
  }

  async updatePeriodo(
    usuarioId: string,
    periodoId: string,
    versaoEsperada: number,
    patch: Partial<Pick<PeriodoRecord, "nome" | "dataInicio" | "dataFim">>
  ): Promise<PeriodoRecord> {
    try {
      const res = await this.prisma.periodoLetivo.updateMany({
        where: { id: periodoId, usuarioId, versao: versaoEsperada },
        data: {
          ...(patch.nome !== undefined ? { nome: patch.nome } : {}),
          ...(patch.dataInicio !== undefined
            ? { dataInicio: patch.dataInicio ? new Date(patch.dataInicio) : null }
            : {}),
          ...(patch.dataFim !== undefined
            ? { dataFim: patch.dataFim ? new Date(patch.dataFim) : null }
            : {}),
          versao: { increment: 1 },
        },
      });
      if (res.count === 0) {
        const exists = await this.findPeriodoById(usuarioId, periodoId);
        if (!exists) throw notFoundError("Período letivo não encontrado.");
        throw versionConflictError();
      }
      return (await this.findPeriodoById(usuarioId, periodoId))!;
    } catch (err) {
      mapPrismaError(err, "um período letivo");
    }
  }

  async deletePeriodoCascade(usuarioId: string, periodoId: string): Promise<void> {
    await this.prisma.periodoLetivo.deleteMany({ where: { id: periodoId, usuarioId } });
  }

  private mapDisc(d: {
    id: string;
    usuarioId: string;
    periodoId: string;
    nome: string;
    codigo: string | null;
    metodoCalculo: string;
    notaMinimaAprovacao: unknown;
    casasDecimais: number;
    permiteSubstitutiva: boolean;
    notaSubstitutiva: unknown;
    notaSubstitutivaEm: Date | null;
    permiteExameFinal: boolean;
    notaMinimaExame: unknown;
    mediaAprovacaoExame: unknown;
    notaExame: unknown;
    notaExameEm: Date | null;
    versao: number;
    criadoEm: Date;
    atualizadoEm: Date;
  }): DisciplinaRecord {
    return {
      id: d.id,
      usuarioId: d.usuarioId,
      periodoId: d.periodoId,
      nome: d.nome,
      codigo: d.codigo,
      metodoCalculo: d.metodoCalculo as MetodoCalculo,
      notaMinimaAprovacao: toNum(d.notaMinimaAprovacao),
      casasDecimais: d.casasDecimais as CasasDecimais,
      permiteSubstitutiva: d.permiteSubstitutiva,
      notaSubstitutiva: toNullableNum(d.notaSubstitutiva),
      notaSubstitutivaEm: d.notaSubstitutivaEm?.toISOString() ?? null,
      permiteExameFinal: d.permiteExameFinal,
      notaMinimaExame: toNum(d.notaMinimaExame),
      mediaAprovacaoExame: toNum(d.mediaAprovacaoExame),
      notaExame: toNullableNum(d.notaExame),
      notaExameEm: d.notaExameEm?.toISOString() ?? null,
      versao: d.versao,
      criadoEm: d.criadoEm.toISOString(),
      atualizadoEm: d.atualizadoEm.toISOString(),
    };
  }

  async listDisciplinasByPeriodo(
    usuarioId: string,
    periodoId: string
  ): Promise<DisciplinaRecord[]> {
    const rows = await this.prisma.disciplina.findMany({
      where: { usuarioId, periodoId },
      orderBy: { nome: "asc" },
    });
    return rows.map((d) => this.mapDisc(d));
  }

  async listAllDisciplinas(usuarioId: string): Promise<DisciplinaRecord[]> {
    const rows = await this.prisma.disciplina.findMany({ where: { usuarioId } });
    return rows.map((d) => this.mapDisc(d));
  }

  async findDisciplinaById(
    usuarioId: string,
    disciplinaId: string
  ): Promise<DisciplinaRecord | null> {
    const d = await this.prisma.disciplina.findFirst({ where: { id: disciplinaId, usuarioId } });
    return d ? this.mapDisc(d) : null;
  }

  async countDisciplinasByPeriodo(usuarioId: string, periodoId: string): Promise<number> {
    return this.prisma.disciplina.count({ where: { usuarioId, periodoId } });
  }

  async createDisciplina(
    usuarioId: string,
    periodoId: string,
    data: Omit<
      DisciplinaRecord,
      | "id"
      | "usuarioId"
      | "periodoId"
      | "notaSubstitutiva"
      | "notaSubstitutivaEm"
      | "notaExame"
      | "notaExameEm"
      | "versao"
      | "criadoEm"
      | "atualizadoEm"
    >
  ): Promise<DisciplinaRecord> {
    try {
      const d = await this.prisma.disciplina.create({
        data: { usuarioId, periodoId, ...data },
      });
      return this.mapDisc(d);
    } catch (err) {
      mapPrismaError(err, "uma disciplina neste período");
    }
  }

  async updateDisciplina(
    usuarioId: string,
    disciplinaId: string,
    versaoEsperada: number,
    patch: Partial<
      Pick<
        DisciplinaRecord,
        | "nome"
        | "codigo"
        | "metodoCalculo"
        | "notaMinimaAprovacao"
        | "casasDecimais"
        | "permiteSubstitutiva"
        | "notaSubstitutiva"
        | "notaSubstitutivaEm"
        | "permiteExameFinal"
        | "notaMinimaExame"
        | "mediaAprovacaoExame"
        | "notaExame"
        | "notaExameEm"
      >
    >
  ): Promise<DisciplinaRecord> {
    try {
      const res = await this.prisma.disciplina.updateMany({
        where: { id: disciplinaId, usuarioId, versao: versaoEsperada },
        data: {
          ...patch,
          ...(patch.notaSubstitutivaEm !== undefined
            ? {
                notaSubstitutivaEm: patch.notaSubstitutivaEm
                  ? new Date(patch.notaSubstitutivaEm)
                  : null,
              }
            : {}),
          ...(patch.notaExameEm !== undefined
            ? { notaExameEm: patch.notaExameEm ? new Date(patch.notaExameEm) : null }
            : {}),
          versao: { increment: 1 },
        },
      });
      if (res.count === 0) {
        const exists = await this.findDisciplinaById(usuarioId, disciplinaId);
        if (!exists) throw notFoundError("Disciplina não encontrada.");
        throw versionConflictError();
      }
      return (await this.findDisciplinaById(usuarioId, disciplinaId))!;
    } catch (err) {
      mapPrismaError(err, "uma disciplina neste período");
    }
  }

  async deleteDisciplinaCascade(usuarioId: string, disciplinaId: string): Promise<void> {
    await this.prisma.disciplina.deleteMany({ where: { id: disciplinaId, usuarioId } });
  }

  private mapAv(a: {
    id: string;
    usuarioId: string;
    disciplinaId: string;
    nome: string;
    peso: unknown;
    nota: unknown;
    notaLancadaEm: Date | null;
    elegivelSubstitutiva: boolean;
    dataPrevista: Date | null;
    ordem: number;
    versao: number;
    criadoEm: Date;
    atualizadoEm: Date;
  }): AvaliacaoRecord {
    return {
      id: a.id,
      usuarioId: a.usuarioId,
      disciplinaId: a.disciplinaId,
      nome: a.nome,
      peso: toNum(a.peso),
      nota: toNullableNum(a.nota),
      notaLancadaEm: a.notaLancadaEm?.toISOString() ?? null,
      elegivelSubstitutiva: a.elegivelSubstitutiva,
      dataPrevista: toDateOnly(a.dataPrevista),
      ordem: a.ordem,
      versao: a.versao,
      criadoEm: a.criadoEm.toISOString(),
      atualizadoEm: a.atualizadoEm.toISOString(),
    };
  }

  async listAvaliacoesByDisciplina(
    usuarioId: string,
    disciplinaId: string
  ): Promise<AvaliacaoRecord[]> {
    const rows = await this.prisma.avaliacao.findMany({
      where: { usuarioId, disciplinaId },
      orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
    });
    return rows.map((a) => this.mapAv(a));
  }

  async listAvaliacoesByPeriodo(
    usuarioId: string,
    periodoId: string
  ): Promise<AvaliacaoRecord[]> {
    const rows = await this.prisma.avaliacao.findMany({
      where: { usuarioId, disciplina: { periodoId, usuarioId } },
      orderBy: { ordem: "asc" },
    });
    return rows.map((a) => this.mapAv(a));
  }

  async findAvaliacaoById(
    usuarioId: string,
    avaliacaoId: string
  ): Promise<AvaliacaoRecord | null> {
    const a = await this.prisma.avaliacao.findFirst({ where: { id: avaliacaoId, usuarioId } });
    return a ? this.mapAv(a) : null;
  }

  async createAvaliacao(
    usuarioId: string,
    disciplinaId: string,
    data: {
      nome: string;
      peso: number;
      elegivelSubstitutiva: boolean;
      dataPrevista: string | null;
      ordem: number;
    }
  ): Promise<AvaliacaoRecord> {
    try {
      const a = await this.prisma.avaliacao.create({
        data: {
          usuarioId,
          disciplinaId,
          nome: data.nome,
          peso: data.peso,
          elegivelSubstitutiva: data.elegivelSubstitutiva,
          dataPrevista: data.dataPrevista ? new Date(data.dataPrevista) : null,
          ordem: data.ordem,
        },
      });
      return this.mapAv(a);
    } catch (err) {
      mapPrismaError(err, "uma avaliação nesta disciplina");
    }
  }

  async updateAvaliacao(
    usuarioId: string,
    avaliacaoId: string,
    versaoEsperada: number,
    patch: Partial<
      Pick<
        AvaliacaoRecord,
        "nome" | "peso" | "nota" | "notaLancadaEm" | "elegivelSubstitutiva" | "dataPrevista" | "ordem"
      >
    >
  ): Promise<AvaliacaoRecord> {
    try {
      const res = await this.prisma.avaliacao.updateMany({
        where: { id: avaliacaoId, usuarioId, versao: versaoEsperada },
        data: {
          ...patch,
          ...(patch.notaLancadaEm !== undefined
            ? { notaLancadaEm: patch.notaLancadaEm ? new Date(patch.notaLancadaEm) : null }
            : {}),
          ...(patch.dataPrevista !== undefined
            ? { dataPrevista: patch.dataPrevista ? new Date(patch.dataPrevista) : null }
            : {}),
          versao: { increment: 1 },
        },
      });
      if (res.count === 0) {
        const exists = await this.findAvaliacaoById(usuarioId, avaliacaoId);
        if (!exists) throw notFoundError("Avaliação não encontrada.");
        throw versionConflictError();
      }
      return (await this.findAvaliacaoById(usuarioId, avaliacaoId))!;
    } catch (err) {
      mapPrismaError(err, "uma avaliação nesta disciplina");
    }
  }

  async reorderAvaliacoes(
    usuarioId: string,
    disciplinaId: string,
    ordemIds: string[]
  ): Promise<void> {
    await this.prisma.$transaction(
      ordemIds.map((id, idx) =>
        this.prisma.avaliacao.updateMany({
          where: { id, usuarioId, disciplinaId },
          data: { ordem: idx },
        })
      )
    );
  }

  async deleteAvaliacao(usuarioId: string, avaliacaoId: string): Promise<void> {
    await this.prisma.avaliacao.deleteMany({ where: { id: avaliacaoId, usuarioId } });
  }

  async appendHistoricoNota(
    usuarioId: string,
    data: {
      disciplinaId: string;
      avaliacaoId: string | null;
      tipoAlvo: "REGULAR" | "SUBSTITUTIVA" | "EXAME_FINAL";
      acao: "LANCADA" | "ALTERADA" | "REMOVIDA";
      notaAnterior: number | null;
      notaNova: number | null;
    }
  ): Promise<HistoricoNotaRecord> {
    const h = await this.prisma.historicoNota.create({
      data: { usuarioId, ...data },
    });
    return {
      id: h.id,
      usuarioId: h.usuarioId,
      disciplinaId: h.disciplinaId,
      avaliacaoId: h.avaliacaoId,
      tipoAlvo: h.tipoAlvo,
      acao: h.acao,
      notaAnterior: toNullableNum(h.notaAnterior),
      notaNova: toNullableNum(h.notaNova),
      criadoEm: h.criadoEm.toISOString(),
    };
  }

  async listHistoricoByAvaliacao(
    usuarioId: string,
    avaliacaoId: string,
    limite: number
  ): Promise<HistoricoNotaRecord[]> {
    const rows = await this.prisma.historicoNota.findMany({
      where: { usuarioId, avaliacaoId },
      orderBy: { criadoEm: "desc" },
      take: limite,
    });
    return rows.map((h) => ({
      id: h.id,
      usuarioId: h.usuarioId,
      disciplinaId: h.disciplinaId,
      avaliacaoId: h.avaliacaoId,
      tipoAlvo: h.tipoAlvo,
      acao: h.acao,
      notaAnterior: toNullableNum(h.notaAnterior),
      notaNova: toNullableNum(h.notaNova),
      criadoEm: h.criadoEm.toISOString(),
    }));
  }

  async listHistoricoByDisciplina(
    usuarioId: string,
    disciplinaId: string,
    limite: number
  ): Promise<HistoricoNotaRecord[]> {
    const rows = await this.prisma.historicoNota.findMany({
      where: { usuarioId, disciplinaId },
      orderBy: { criadoEm: "desc" },
      take: limite,
    });
    return rows.map((h) => ({
      id: h.id,
      usuarioId: h.usuarioId,
      disciplinaId: h.disciplinaId,
      avaliacaoId: h.avaliacaoId,
      tipoAlvo: h.tipoAlvo,
      acao: h.acao,
      notaAnterior: toNullableNum(h.notaAnterior),
      notaNova: toNullableNum(h.notaNova),
      criadoEm: h.criadoEm.toISOString(),
    }));
  }

  async appendAuditoria(data: {
    usuarioId: string | null;
    tipo: string;
    metadados: Record<string, unknown>;
  }): Promise<EventoAuditoriaRecord> {
    const e = await this.prisma.eventoAuditoria.create({
      data: {
        usuarioId: data.usuarioId,
        tipo: data.tipo,
        metadados: data.metadados as object,
      },
    });
    return {
      id: e.id,
      usuarioId: e.usuarioId,
      tipo: e.tipo,
      metadados: e.metadados as Record<string, unknown>,
      criadoEm: e.criadoEm.toISOString(),
    };
  }

  async listAuditoria(usuarioId: string): Promise<EventoAuditoriaRecord[]> {
    const rows = await this.prisma.eventoAuditoria.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: "desc" },
    });
    return rows.map((e) => ({
      id: e.id,
      usuarioId: e.usuarioId,
      tipo: e.tipo,
      metadados: e.metadados as Record<string, unknown>,
      criadoEm: e.criadoEm.toISOString(),
    }));
  }
}
