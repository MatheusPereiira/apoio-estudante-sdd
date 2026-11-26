import { randomUUID } from "node:crypto";
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

/**
 * Repositório transacional em memória implementando 100% do contrato AppRepositoryPort.
 * Garante isolamento RN01 (usuarioId), unicidade RN15 (case-insensitive), versão otimista RN16
 * e cascade LGPD RN17 — ideal para testes rápidos, CI determinístico e execução local instantânea.
 */
export class InMemoryAppRepository implements AppRepositoryPort {
  readonly usuarios = new Map<string, UsuarioRecord>();
  readonly sessoes = new Map<string, SessaoRecord>();
  readonly periodos = new Map<string, PeriodoRecord>();
  readonly disciplinas = new Map<string, DisciplinaRecord>();
  readonly avaliacoes = new Map<string, AvaliacaoRecord>();
  readonly historicos: HistoricoNotaRecord[] = [];
  readonly auditorias: EventoAuditoriaRecord[] = [];

  async ping(): Promise<boolean> {
    return true;
  }

  async findUsuarioByEmail(email: string): Promise<UsuarioRecord | null> {
    const norm = email.trim().toLowerCase();
    for (const u of this.usuarios.values()) {
      if (u.email.toLowerCase() === norm) return { ...u };
    }
    return null;
  }

  async findUsuarioById(usuarioId: string): Promise<UsuarioRecord | null> {
    const u = this.usuarios.get(usuarioId);
    return u ? { ...u } : null;
  }

  async createUsuario(data: {
    nome: string;
    email: string;
    senhaHash: string;
    termosVersao: string;
  }): Promise<UsuarioRecord> {
    const now = new Date().toISOString();
    const record: UsuarioRecord = {
      id: randomUUID(),
      nome: data.nome,
      email: data.email.toLowerCase(),
      senhaHash: data.senhaHash,
      termosVersao: data.termosVersao,
      termosAceitosEm: now,
      tentativasFalhas: 0,
      bloqueadoAte: null,
      criadoEm: now,
      atualizadoEm: now,
    };
    this.usuarios.set(record.id, record);
    return { ...record };
  }

  async updateUsuario(
    usuarioId: string,
    patch: Partial<Pick<UsuarioRecord, "nome" | "tentativasFalhas" | "bloqueadoAte">>
  ): Promise<UsuarioRecord | null> {
    const u = this.usuarios.get(usuarioId);
    if (!u) return null;
    const updated: UsuarioRecord = {
      ...u,
      ...patch,
      atualizadoEm: new Date().toISOString(),
    };
    this.usuarios.set(usuarioId, updated);
    return { ...updated };
  }

  async deleteUsuarioCascade(usuarioId: string): Promise<void> {
    this.usuarios.delete(usuarioId);
    for (const [id, s] of this.sessoes.entries()) {
      if (s.usuarioId === usuarioId) this.sessoes.delete(id);
    }
    for (const [id, p] of this.periodos.entries()) {
      if (p.usuarioId === usuarioId) this.periodos.delete(id);
    }
    for (const [id, d] of this.disciplinas.entries()) {
      if (d.usuarioId === usuarioId) this.disciplinas.delete(id);
    }
    for (const [id, a] of this.avaliacoes.entries()) {
      if (a.usuarioId === usuarioId) this.avaliacoes.delete(id);
    }
    for (let i = this.historicos.length - 1; i >= 0; i--) {
      if (this.historicos[i]?.usuarioId === usuarioId) {
        this.historicos.splice(i, 1);
      }
    }
    // L-09: anula usuarioId nos logs de auditoria preservando rastreabilidade sem PII
    for (const ev of this.auditorias) {
      if (ev.usuarioId === usuarioId) {
        ev.usuarioId = null;
      }
    }
  }

  async createSessao(data: {
    usuarioId: string;
    familiaId: string;
    refreshTokenHash: string;
    userAgent: string | null;
    ipHash: string | null;
    expiraEm: string;
  }): Promise<SessaoRecord> {
    const record: SessaoRecord = {
      id: randomUUID(),
      ...data,
      revogadaEm: null,
      criadoEm: new Date().toISOString(),
    };
    this.sessoes.set(record.id, record);
    return { ...record };
  }

  async findSessaoByRefreshHash(refreshTokenHash: string): Promise<SessaoRecord | null> {
    for (const s of this.sessoes.values()) {
      if (s.refreshTokenHash === refreshTokenHash) return { ...s };
    }
    return null;
  }

  async revokeSessao(sessaoId: string): Promise<void> {
    const s = this.sessoes.get(sessaoId);
    if (s && s.revogadaEm === null) {
      s.revogadaEm = new Date().toISOString();
    }
  }

  async revokeFamiliaSessoes(familiaId: string): Promise<void> {
    const now = new Date().toISOString();
    for (const s of this.sessoes.values()) {
      if (s.familiaId === familiaId && s.revogadaEm === null) {
        s.revogadaEm = now;
      }
    }
  }

  async revokeAllSessoesUsuario(usuarioId: string): Promise<void> {
    const now = new Date().toISOString();
    for (const s of this.sessoes.values()) {
      if (s.usuarioId === usuarioId && s.revogadaEm === null) {
        s.revogadaEm = now;
      }
    }
  }

  async listPeriodos(usuarioId: string): Promise<PeriodoRecord[]> {
    return [...this.periodos.values()]
      .filter((p) => p.usuarioId === usuarioId)
      .map((p) => ({ ...p }));
  }

  async findPeriodoById(usuarioId: string, periodoId: string): Promise<PeriodoRecord | null> {
    const p = this.periodos.get(periodoId);
    if (!p || p.usuarioId !== usuarioId) return null;
    return { ...p };
  }

  async countPeriodos(usuarioId: string): Promise<number> {
    let count = 0;
    for (const p of this.periodos.values()) {
      if (p.usuarioId === usuarioId) count++;
    }
    return count;
  }

  async createPeriodo(
    usuarioId: string,
    data: { nome: string; dataInicio: string | null; dataFim: string | null }
  ): Promise<PeriodoRecord> {
    const norm = data.nome.trim().toLowerCase();
    for (const p of this.periodos.values()) {
      if (p.usuarioId === usuarioId && p.nome.trim().toLowerCase() === norm) {
        throw duplicateNameError("um período letivo");
      }
    }
    const now = new Date().toISOString();
    const record: PeriodoRecord = {
      id: randomUUID(),
      usuarioId,
      nome: data.nome.trim(),
      dataInicio: data.dataInicio,
      dataFim: data.dataFim,
      versao: 1,
      criadoEm: now,
      atualizadoEm: now,
    };
    this.periodos.set(record.id, record);
    return { ...record };
  }

  async updatePeriodo(
    usuarioId: string,
    periodoId: string,
    versaoEsperada: number,
    patch: Partial<Pick<PeriodoRecord, "nome" | "dataInicio" | "dataFim">>
  ): Promise<PeriodoRecord> {
    const p = this.periodos.get(periodoId);
    if (!p || p.usuarioId !== usuarioId) throw notFoundError("Período letivo não encontrado.");
    if (p.versao !== versaoEsperada) throw versionConflictError();

    if (patch.nome !== undefined) {
      const norm = patch.nome.trim().toLowerCase();
      for (const other of this.periodos.values()) {
        if (
          other.usuarioId === usuarioId &&
          other.id !== periodoId &&
          other.nome.trim().toLowerCase() === norm
        ) {
          throw duplicateNameError("um período letivo");
        }
      }
    }

    const updated: PeriodoRecord = {
      ...p,
      ...patch,
      nome: patch.nome !== undefined ? patch.nome.trim() : p.nome,
      versao: p.versao + 1,
      atualizadoEm: new Date().toISOString(),
    };
    this.periodos.set(periodoId, updated);
    return { ...updated };
  }

  async deletePeriodoCascade(usuarioId: string, periodoId: string): Promise<void> {
    const p = this.periodos.get(periodoId);
    if (!p || p.usuarioId !== usuarioId) return;
    this.periodos.delete(periodoId);
    const discIds = new Set<string>();
    for (const [id, d] of this.disciplinas.entries()) {
      if (d.usuarioId === usuarioId && d.periodoId === periodoId) {
        discIds.add(id);
        this.disciplinas.delete(id);
      }
    }
    for (const [id, a] of this.avaliacoes.entries()) {
      if (a.usuarioId === usuarioId && discIds.has(a.disciplinaId)) {
        this.avaliacoes.delete(id);
      }
    }
    for (let i = this.historicos.length - 1; i >= 0; i--) {
      const h = this.historicos[i];
      if (h && h.usuarioId === usuarioId && discIds.has(h.disciplinaId)) {
        this.historicos.splice(i, 1);
      }
    }
  }

  async listDisciplinasByPeriodo(
    usuarioId: string,
    periodoId: string
  ): Promise<DisciplinaRecord[]> {
    return [...this.disciplinas.values()]
      .filter((d) => d.usuarioId === usuarioId && d.periodoId === periodoId)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map((d) => ({ ...d }));
  }

  async listAllDisciplinas(usuarioId: string): Promise<DisciplinaRecord[]> {
    return [...this.disciplinas.values()]
      .filter((d) => d.usuarioId === usuarioId)
      .map((d) => ({ ...d }));
  }

  async findDisciplinaById(
    usuarioId: string,
    disciplinaId: string
  ): Promise<DisciplinaRecord | null> {
    const d = this.disciplinas.get(disciplinaId);
    if (!d || d.usuarioId !== usuarioId) return null;
    return { ...d };
  }

  async countDisciplinasByPeriodo(usuarioId: string, periodoId: string): Promise<number> {
    let count = 0;
    for (const d of this.disciplinas.values()) {
      if (d.usuarioId === usuarioId && d.periodoId === periodoId) count++;
    }
    return count;
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
    const norm = data.nome.trim().toLowerCase();
    for (const d of this.disciplinas.values()) {
      if (
        d.usuarioId === usuarioId &&
        d.periodoId === periodoId &&
        d.nome.trim().toLowerCase() === norm
      ) {
        throw duplicateNameError("uma disciplina neste período");
      }
    }
    const now = new Date().toISOString();
    const record: DisciplinaRecord = {
      id: randomUUID(),
      usuarioId,
      periodoId,
      ...data,
      nome: data.nome.trim(),
      notaSubstitutiva: null,
      notaSubstitutivaEm: null,
      notaExame: null,
      notaExameEm: null,
      versao: 1,
      criadoEm: now,
      atualizadoEm: now,
    };
    this.disciplinas.set(record.id, record);
    return { ...record };
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
    const d = this.disciplinas.get(disciplinaId);
    if (!d || d.usuarioId !== usuarioId) throw notFoundError("Disciplina não encontrada.");
    if (d.versao !== versaoEsperada) throw versionConflictError();

    if (patch.nome !== undefined) {
      const norm = patch.nome.trim().toLowerCase();
      for (const other of this.disciplinas.values()) {
        if (
          other.usuarioId === usuarioId &&
          other.periodoId === d.periodoId &&
          other.id !== disciplinaId &&
          other.nome.trim().toLowerCase() === norm
        ) {
          throw duplicateNameError("uma disciplina neste período");
        }
      }
    }

    const updated: DisciplinaRecord = {
      ...d,
      ...patch,
      nome: patch.nome !== undefined ? patch.nome.trim() : d.nome,
      versao: d.versao + 1,
      atualizadoEm: new Date().toISOString(),
    };
    this.disciplinas.set(disciplinaId, updated);
    return { ...updated };
  }

  async deleteDisciplinaCascade(usuarioId: string, disciplinaId: string): Promise<void> {
    const d = this.disciplinas.get(disciplinaId);
    if (!d || d.usuarioId !== usuarioId) return;
    this.disciplinas.delete(disciplinaId);
    for (const [id, a] of this.avaliacoes.entries()) {
      if (a.usuarioId === usuarioId && a.disciplinaId === disciplinaId) {
        this.avaliacoes.delete(id);
      }
    }
    for (let i = this.historicos.length - 1; i >= 0; i--) {
      const h = this.historicos[i];
      if (h && h.usuarioId === usuarioId && h.disciplinaId === disciplinaId) {
        this.historicos.splice(i, 1);
      }
    }
  }

  async listAvaliacoesByDisciplina(
    usuarioId: string,
    disciplinaId: string
  ): Promise<AvaliacaoRecord[]> {
    return [...this.avaliacoes.values()]
      .filter((a) => a.usuarioId === usuarioId && a.disciplinaId === disciplinaId)
      .sort((a, b) => a.ordem - b.ordem || a.criadoEm.localeCompare(b.criadoEm))
      .map((a) => ({ ...a }));
  }

  async listAvaliacoesByPeriodo(
    usuarioId: string,
    periodoId: string
  ): Promise<AvaliacaoRecord[]> {
    const discIds = new Set(
      [...this.disciplinas.values()]
        .filter((d) => d.usuarioId === usuarioId && d.periodoId === periodoId)
        .map((d) => d.id)
    );
    return [...this.avaliacoes.values()]
      .filter((a) => a.usuarioId === usuarioId && discIds.has(a.disciplinaId))
      .sort((a, b) => a.ordem - b.ordem)
      .map((a) => ({ ...a }));
  }

  async findAvaliacaoById(
    usuarioId: string,
    avaliacaoId: string
  ): Promise<AvaliacaoRecord | null> {
    const a = this.avaliacoes.get(avaliacaoId);
    if (!a || a.usuarioId !== usuarioId) return null;
    return { ...a };
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
    const norm = data.nome.trim().toLowerCase();
    for (const a of this.avaliacoes.values()) {
      if (
        a.usuarioId === usuarioId &&
        a.disciplinaId === disciplinaId &&
        a.nome.trim().toLowerCase() === norm
      ) {
        throw duplicateNameError("uma avaliação nesta disciplina");
      }
    }
    const now = new Date().toISOString();
    const record: AvaliacaoRecord = {
      id: randomUUID(),
      usuarioId,
      disciplinaId,
      nome: data.nome.trim(),
      peso: data.peso,
      nota: null,
      notaLancadaEm: null,
      elegivelSubstitutiva: data.elegivelSubstitutiva,
      dataPrevista: data.dataPrevista,
      ordem: data.ordem,
      versao: 1,
      criadoEm: now,
      atualizadoEm: now,
    };
    this.avaliacoes.set(record.id, record);
    return { ...record };
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
    const a = this.avaliacoes.get(avaliacaoId);
    if (!a || a.usuarioId !== usuarioId) throw notFoundError("Avaliação não encontrada.");
    if (a.versao !== versaoEsperada) throw versionConflictError();

    if (patch.nome !== undefined) {
      const norm = patch.nome.trim().toLowerCase();
      for (const other of this.avaliacoes.values()) {
        if (
          other.usuarioId === usuarioId &&
          other.disciplinaId === a.disciplinaId &&
          other.id !== avaliacaoId &&
          other.nome.trim().toLowerCase() === norm
        ) {
          throw duplicateNameError("uma avaliação nesta disciplina");
        }
      }
    }

    const updated: AvaliacaoRecord = {
      ...a,
      ...patch,
      nome: patch.nome !== undefined ? patch.nome.trim() : a.nome,
      versao: a.versao + 1,
      atualizadoEm: new Date().toISOString(),
    };
    this.avaliacoes.set(avaliacaoId, updated);
    return { ...updated };
  }

  async reorderAvaliacoes(
    usuarioId: string,
    disciplinaId: string,
    ordemIds: string[]
  ): Promise<void> {
    ordemIds.forEach((id, idx) => {
      const a = this.avaliacoes.get(id);
      if (a && a.usuarioId === usuarioId && a.disciplinaId === disciplinaId) {
        a.ordem = idx;
        a.atualizadoEm = new Date().toISOString();
      }
    });
  }

  async deleteAvaliacao(usuarioId: string, avaliacaoId: string): Promise<void> {
    const a = this.avaliacoes.get(avaliacaoId);
    if (!a || a.usuarioId !== usuarioId) return;
    this.avaliacoes.delete(avaliacaoId);
    for (let i = this.historicos.length - 1; i >= 0; i--) {
      if (this.historicos[i]?.avaliacaoId === avaliacaoId) {
        this.historicos.splice(i, 1);
      }
    }
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
    const record: HistoricoNotaRecord = {
      id: randomUUID(),
      usuarioId,
      ...data,
      criadoEm: new Date().toISOString(),
    };
    this.historicos.push(record);
    return { ...record };
  }

  async listHistoricoByAvaliacao(
    usuarioId: string,
    avaliacaoId: string,
    limite: number
  ): Promise<HistoricoNotaRecord[]> {
    return this.historicos
      .filter((h) => h.usuarioId === usuarioId && h.avaliacaoId === avaliacaoId)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
      .slice(0, limite)
      .map((h) => ({ ...h }));
  }

  async listHistoricoByDisciplina(
    usuarioId: string,
    disciplinaId: string,
    limite: number
  ): Promise<HistoricoNotaRecord[]> {
    return this.historicos
      .filter((h) => h.usuarioId === usuarioId && h.disciplinaId === disciplinaId)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
      .slice(0, limite)
      .map((h) => ({ ...h }));
  }

  async appendAuditoria(data: {
    usuarioId: string | null;
    tipo: string;
    metadados: Record<string, unknown>;
  }): Promise<EventoAuditoriaRecord> {
    const record: EventoAuditoriaRecord = {
      id: randomUUID(),
      usuarioId: data.usuarioId,
      tipo: data.tipo,
      metadados: data.metadados,
      criadoEm: new Date().toISOString(),
    };
    this.auditorias.push(record);
    return { ...record };
  }

  async listAuditoria(usuarioId: string): Promise<EventoAuditoriaRecord[]> {
    return this.auditorias
      .filter((e) => e.usuarioId === usuarioId)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
      .map((e) => ({ ...e }));
  }
}
