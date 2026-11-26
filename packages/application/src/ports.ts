import type { CasasDecimais, MetodoCalculo } from "@app/domain";

export type AcaoNota = "LANCADA" | "ALTERADA" | "REMOVIDA";
export type TipoAlvoNota = "REGULAR" | "SUBSTITUTIVA" | "EXAME_FINAL";

export interface UsuarioRecord {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  termosVersao: string;
  termosAceitosEm: string;
  tentativasFalhas: number;
  bloqueadoAte: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface SessaoRecord {
  id: string;
  usuarioId: string;
  familiaId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipHash: string | null;
  expiraEm: string;
  revogadaEm: string | null;
  criadoEm: string;
}

export interface PeriodoRecord {
  id: string;
  usuarioId: string;
  nome: string;
  dataInicio: string | null;
  dataFim: string | null;
  versao: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface DisciplinaRecord {
  id: string;
  usuarioId: string;
  periodoId: string;
  nome: string;
  codigo: string | null;
  metodoCalculo: MetodoCalculo;
  notaMinimaAprovacao: number;
  casasDecimais: CasasDecimais;
  permiteSubstitutiva: boolean;
  notaSubstitutiva: number | null;
  notaSubstitutivaEm: string | null;
  permiteExameFinal: boolean;
  notaMinimaExame: number;
  mediaAprovacaoExame: number;
  notaExame: number | null;
  notaExameEm: string | null;
  versao: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface AvaliacaoRecord {
  id: string;
  usuarioId: string;
  disciplinaId: string;
  nome: string;
  peso: number;
  nota: number | null;
  notaLancadaEm: string | null;
  elegivelSubstitutiva: boolean;
  dataPrevista: string | null;
  ordem: number;
  versao: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface HistoricoNotaRecord {
  id: string;
  usuarioId: string;
  disciplinaId: string;
  avaliacaoId: string | null;
  tipoAlvo: TipoAlvoNota;
  acao: AcaoNota;
  notaAnterior: number | null;
  notaNova: number | null;
  criadoEm: string;
}

export interface EventoAuditoriaRecord {
  id: string;
  usuarioId: string | null;
  tipo: string;
  metadados: Record<string, unknown>;
  criadoEm: string;
}

export interface CryptoPort {
  hashPassword(plain: string): Promise<string>;
  verifyPassword(plain: string, hash: string): Promise<boolean>;
  signAccessToken(payload: { sub: string; email: string }): Promise<string>;
  verifyAccessToken(token: string): Promise<{ sub: string; email: string } | null>;
  generateOpaqueToken(): string;
  hashToken(token: string): string;
  hashIp(ip: string | null): string | null;
  generateId(): string;
}

/**
 * Porta de persistência unificada (Constituição C3 / RN01):
 * Nenhum método de recurso acadêmico pode consultar ou alterar registros sem `usuarioId`.
 */
export interface AppRepositoryPort {
  // Saúde
  ping(): Promise<boolean>;

  // Usuários & Sessões
  findUsuarioByEmail(email: string): Promise<UsuarioRecord | null>;
  findUsuarioById(usuarioId: string): Promise<UsuarioRecord | null>;
  createUsuario(data: {
    nome: string;
    email: string;
    senhaHash: string;
    termosVersao: string;
  }): Promise<UsuarioRecord>;
  updateUsuario(
    usuarioId: string,
    patch: Partial<Pick<UsuarioRecord, "nome" | "tentativasFalhas" | "bloqueadoAte">>
  ): Promise<UsuarioRecord | null>;
  deleteUsuarioCascade(usuarioId: string): Promise<void>;

  createSessao(data: {
    usuarioId: string;
    familiaId: string;
    refreshTokenHash: string;
    userAgent: string | null;
    ipHash: string | null;
    expiraEm: string;
  }): Promise<SessaoRecord>;
  findSessaoByRefreshHash(refreshTokenHash: string): Promise<SessaoRecord | null>;
  revokeSessao(sessaoId: string): Promise<void>;
  revokeFamiliaSessoes(familiaId: string): Promise<void>;
  revokeAllSessoesUsuario(usuarioId: string): Promise<void>;

  // Períodos (sempre isolados por usuarioId)
  listPeriodos(usuarioId: string): Promise<PeriodoRecord[]>;
  findPeriodoById(usuarioId: string, periodoId: string): Promise<PeriodoRecord | null>;
  countPeriodos(usuarioId: string): Promise<number>;
  createPeriodo(
    usuarioId: string,
    data: { nome: string; dataInicio: string | null; dataFim: string | null }
  ): Promise<PeriodoRecord>;
  updatePeriodo(
    usuarioId: string,
    periodoId: string,
    versaoEsperada: number,
    patch: Partial<Pick<PeriodoRecord, "nome" | "dataInicio" | "dataFim">>
  ): Promise<PeriodoRecord>;
  deletePeriodoCascade(usuarioId: string, periodoId: string): Promise<void>;

  // Disciplinas (sempre isoladas por usuarioId)
  listDisciplinasByPeriodo(usuarioId: string, periodoId: string): Promise<DisciplinaRecord[]>;
  listAllDisciplinas(usuarioId: string): Promise<DisciplinaRecord[]>;
  findDisciplinaById(usuarioId: string, disciplinaId: string): Promise<DisciplinaRecord | null>;
  countDisciplinasByPeriodo(usuarioId: string, periodoId: string): Promise<number>;
  createDisciplina(
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
  ): Promise<DisciplinaRecord>;
  updateDisciplina(
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
  ): Promise<DisciplinaRecord>;
  deleteDisciplinaCascade(usuarioId: string, disciplinaId: string): Promise<void>;

  // Avaliações (sempre isoladas por usuarioId)
  listAvaliacoesByDisciplina(usuarioId: string, disciplinaId: string): Promise<AvaliacaoRecord[]>;
  listAvaliacoesByPeriodo(usuarioId: string, periodoId: string): Promise<AvaliacaoRecord[]>;
  findAvaliacaoById(usuarioId: string, avaliacaoId: string): Promise<AvaliacaoRecord | null>;
  createAvaliacao(
    usuarioId: string,
    disciplinaId: string,
    data: {
      nome: string;
      peso: number;
      elegivelSubstitutiva: boolean;
      dataPrevista: string | null;
      ordem: number;
    }
  ): Promise<AvaliacaoRecord>;
  updateAvaliacao(
    usuarioId: string,
    avaliacaoId: string,
    versaoEsperada: number,
    patch: Partial<
      Pick<
        AvaliacaoRecord,
        "nome" | "peso" | "nota" | "notaLancadaEm" | "elegivelSubstitutiva" | "dataPrevista" | "ordem"
      >
    >
  ): Promise<AvaliacaoRecord>;
  reorderAvaliacoes(usuarioId: string, disciplinaId: string, ordemIds: string[]): Promise<void>;
  deleteAvaliacao(usuarioId: string, avaliacaoId: string): Promise<void>;

  // Histórico imutável (append-only, RN11)
  appendHistoricoNota(
    usuarioId: string,
    data: {
      disciplinaId: string;
      avaliacaoId: string | null;
      tipoAlvo: TipoAlvoNota;
      acao: AcaoNota;
      notaAnterior: number | null;
      notaNova: number | null;
    }
  ): Promise<HistoricoNotaRecord>;
  listHistoricoByAvaliacao(
    usuarioId: string,
    avaliacaoId: string,
    limite: number
  ): Promise<HistoricoNotaRecord[]>;
  listHistoricoByDisciplina(
    usuarioId: string,
    disciplinaId: string,
    limite: number
  ): Promise<HistoricoNotaRecord[]>;

  // Auditoria (sem PII)
  appendAuditoria(data: {
    usuarioId: string | null;
    tipo: string;
    metadados: Record<string, unknown>;
  }): Promise<EventoAuditoriaRecord>;
  listAuditoria(usuarioId: string): Promise<EventoAuditoriaRecord[]>;
}
