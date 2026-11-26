import {
  DomainError,
  type DeleteMeInput,
  type LoginInput,
  type RegisterInput,
  type UpdateMeInput,
} from "@app/contracts";
import type { AppRepositoryPort, CryptoPort, UsuarioRecord } from "./ports.js";

const MAX_TENTATIVAS_FALHAS = 5;
const BLOQUEIO_MINUTOS = 15;
const REFRESH_TTL_DIAS = 7;

export interface AuthSessionResult {
  usuario: {
    id: string;
    nome: string;
    email: string;
    termosVersao: string;
    criadoEm: string;
  };
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

export class AuthService {
  constructor(
    private readonly repo: AppRepositoryPort,
    private readonly crypto: CryptoPort
  ) {}

  private toPublicUsuario(u: UsuarioRecord) {
    return {
      id: u.id,
      nome: u.nome,
      email: u.email,
      termosVersao: u.termosVersao,
      criadoEm: u.criadoEm,
    };
  }

  private async issueSession(
    usuario: UsuarioRecord,
    meta: { userAgent?: string | null; ip?: string | null; familiaId?: string }
  ): Promise<AuthSessionResult> {
    const accessToken = await this.crypto.signAccessToken({
      sub: usuario.id,
      email: usuario.email,
    });
    const refreshToken = this.crypto.generateOpaqueToken();
    const csrfToken = this.crypto.generateOpaqueToken();
    const familiaId = meta.familiaId ?? this.crypto.generateId();
    const expiraEm = new Date(Date.now() + REFRESH_TTL_DIAS * 24 * 60 * 60 * 1000).toISOString();

    await this.repo.createSessao({
      usuarioId: usuario.id,
      familiaId,
      refreshTokenHash: this.crypto.hashToken(refreshToken),
      userAgent: meta.userAgent ?? null,
      ipHash: this.crypto.hashIp(meta.ip ?? null),
      expiraEm,
    });

    return {
      usuario: this.toPublicUsuario(usuario),
      accessToken,
      refreshToken,
      csrfToken,
    };
  }

  /** E02 — Cadastro de estudante (RF01 / CA01.1–CA01.4) */
  async register(
    input: RegisterInput,
    meta: { userAgent?: string | null; ip?: string | null } = {}
  ): Promise<AuthSessionResult> {
    const existing = await this.repo.findUsuarioByEmail(input.email);
    if (existing) {
      // CA01.2: erro genérico sem confirmar existência da conta
      throw new DomainError({
        status: 422,
        code: "CADASTRO_INVALIDO",
        title: "Não foi possível concluir o cadastro",
        detail: "Verifique os dados informados e tente novamente.",
      });
    }

    const senhaHash = await this.crypto.hashPassword(input.senha);
    const usuario = await this.repo.createUsuario({
      nome: input.nome,
      email: input.email,
      senhaHash,
      termosVersao: input.termosVersao,
    });

    await this.repo.appendAuditoria({
      usuarioId: usuario.id,
      tipo: "CONTA_CRIADA",
      metadados: { termosVersao: input.termosVersao },
    });

    return this.issueSession(usuario, meta);
  }

  /** E03 — Login com bloqueio após 5 falhas em 15 min (RF02 / CA02.1–CA02.2 / CT05) */
  async login(
    input: LoginInput,
    meta: { userAgent?: string | null; ip?: string | null } = {}
  ): Promise<AuthSessionResult> {
    const usuario = await this.repo.findUsuarioByEmail(input.email);
    if (!usuario) {
      throw new DomainError({
        status: 401,
        code: "CREDENCIAIS_INVALIDAS",
        title: "Credenciais inválidas",
        detail: "E-mail ou senha incorretos.",
      });
    }

    const agora = Date.now();
    if (usuario.bloqueadoAte && new Date(usuario.bloqueadoAte).getTime() > agora) {
      throw new DomainError({
        status: 423,
        code: "CONTA_BLOQUEADA",
        title: "Conta temporariamente bloqueada",
        detail: "Muitas tentativas inválidas. Aguarde antes de tentar novamente.",
        extra: { bloqueadoAte: usuario.bloqueadoAte },
      });
    }

    const senhaValida = await this.crypto.verifyPassword(input.senha, usuario.senhaHash);
    if (!senhaValida) {
      const novasTentativas = usuario.tentativasFalhas + 1;
      const deveBloquear = novasTentativas >= MAX_TENTATIVAS_FALHAS;
      const bloqueadoAte = deveBloquear
        ? new Date(agora + BLOQUEIO_MINUTOS * 60 * 1000).toISOString()
        : null;

      await this.repo.updateUsuario(usuario.id, {
        tentativasFalhas: novasTentativas,
        bloqueadoAte,
      });

      await this.repo.appendAuditoria({
        usuarioId: usuario.id,
        tipo: deveBloquear ? "CONTA_BLOQUEADA" : "LOGIN_FALHA",
        metadados: { tentativasFalhas: novasTentativas },
      });

      if (deveBloquear) {
        throw new DomainError({
          status: 423,
          code: "CONTA_BLOQUEADA",
          title: "Conta temporariamente bloqueada",
          detail: "Conta bloqueada por 15 minutos após 5 tentativas incorretas.",
          extra: { bloqueadoAte },
        });
      }

      throw new DomainError({
        status: 401,
        code: "CREDENCIAIS_INVALIDAS",
        title: "Credenciais inválidas",
        detail: "E-mail ou senha incorretos.",
      });
    }

    if (usuario.tentativasFalhas > 0 || usuario.bloqueadoAte !== null) {
      await this.repo.updateUsuario(usuario.id, {
        tentativasFalhas: 0,
        bloqueadoAte: null,
      });
    }

    await this.repo.appendAuditoria({
      usuarioId: usuario.id,
      tipo: "LOGIN_SUCESSO",
      metadados: {},
    });

    return this.issueSession(usuario, meta);
  }

  /** E04 — Refresh rotativo com detecção de reuso e revogação da família (CA02.3–CA02.4 / CT05) */
  async refresh(
    refreshToken: string | null | undefined,
    meta: { userAgent?: string | null; ip?: string | null } = {}
  ): Promise<AuthSessionResult> {
    if (!refreshToken) {
      throw new DomainError({
        status: 401,
        code: "NAO_AUTENTICADO",
        title: "Não autenticado",
        detail: "Sessão ausente ou expirada.",
      });
    }

    const tokenHash = this.crypto.hashToken(refreshToken);
    const sessao = await this.repo.findSessaoByRefreshHash(tokenHash);

    if (!sessao) {
      throw new DomainError({
        status: 401,
        code: "NAO_AUTENTICADO",
        title: "Não autenticado",
        detail: "Token de renovação inválido.",
      });
    }

    // CA02.4: Se já foi revogado (reuso), revoga TODA a família de sessões!
    if (sessao.revogadaEm !== null) {
      await this.repo.revokeFamiliaSessoes(sessao.familiaId);
      await this.repo.appendAuditoria({
        usuarioId: sessao.usuarioId,
        tipo: "REFRESH_REUSO_DETECTADO",
        metadados: { familiaId: sessao.familiaId },
      });
      throw new DomainError({
        status: 401,
        code: "NAO_AUTENTICADO",
        title: "Sessão revogada por segurança",
        detail: "Reutilização de token detectada. Faça login novamente.",
      });
    }

    if (new Date(sessao.expiraEm).getTime() <= Date.now()) {
      await this.repo.revokeSessao(sessao.id);
      throw new DomainError({
        status: 401,
        code: "NAO_AUTENTICADO",
        title: "Sessão expirada",
        detail: "Faça login novamente.",
      });
    }

    const usuario = await this.repo.findUsuarioById(sessao.usuarioId);
    if (!usuario) {
      throw new DomainError({
        status: 401,
        code: "NAO_AUTENTICADO",
        title: "Não autenticado",
        detail: "Conta inexistente.",
      });
    }

    // Revoga o token anterior e emite o próximo na mesma família
    await this.repo.revokeSessao(sessao.id);
    return this.issueSession(usuario, { ...meta, familiaId: sessao.familiaId });
  }

  /** E05 — Logout (CA02.5) */
  async logout(usuarioId: string, refreshToken?: string | null): Promise<void> {
    if (refreshToken) {
      const sessao = await this.repo.findSessaoByRefreshHash(this.crypto.hashToken(refreshToken));
      if (sessao && sessao.usuarioId === usuarioId) {
        await this.repo.revokeSessao(sessao.id);
      }
    } else {
      await this.repo.revokeAllSessoesUsuario(usuarioId);
    }

    await this.repo.appendAuditoria({
      usuarioId,
      tipo: "LOGOUT",
      metadados: {},
    });
  }

  /** E06 — Perfil atual */
  async getMe(usuarioId: string) {
    const usuario = await this.repo.findUsuarioById(usuarioId);
    if (!usuario) {
      throw new DomainError({
        status: 401,
        code: "NAO_AUTENTICADO",
        title: "Não autenticado",
        detail: "Usuário não encontrado.",
      });
    }
    return this.toPublicUsuario(usuario);
  }

  /** E07 — Atualizar nome do perfil */
  async updateMe(usuarioId: string, input: UpdateMeInput) {
    const atualizado = await this.repo.updateUsuario(usuarioId, { nome: input.nome });
    if (!atualizado) {
      throw new DomainError({
        status: 401,
        code: "NAO_AUTENTICADO",
        title: "Não autenticado",
        detail: "Usuário não encontrado.",
      });
    }
    return this.toPublicUsuario(atualizado);
  }

  /** E08 — Exportação LGPD completa em JSON (RF03 / CA03.1) */
  async exportMe(usuarioId: string) {
    const usuario = await this.repo.findUsuarioById(usuarioId);
    if (!usuario) {
      throw new DomainError({
        status: 401,
        code: "NAO_AUTENTICADO",
        title: "Não autenticado",
        detail: "Usuário não encontrado.",
      });
    }

    const periodos = await this.repo.listPeriodos(usuarioId);
    const periodosExport = await Promise.all(
      periodos.map(async (p) => {
        const disciplinas = await this.repo.listDisciplinasByPeriodo(usuarioId, p.id);
        const disciplinasExport = await Promise.all(
          disciplinas.map(async (d) => {
            const avaliacoes = await this.repo.listAvaliacoesByDisciplina(usuarioId, d.id);
            const avaliacoesExport = await Promise.all(
              avaliacoes.map(async (a) => ({
                id: a.id,
                nome: a.nome,
                peso: a.peso,
                nota: a.nota,
                elegivelSubstitutiva: a.elegivelSubstitutiva,
                dataPrevista: a.dataPrevista,
                historico: await this.repo.listHistoricoByAvaliacao(usuarioId, a.id, 100),
              }))
            );

            return {
              id: d.id,
              nome: d.nome,
              codigo: d.codigo,
              metodoCalculo: d.metodoCalculo,
              notaMinimaAprovacao: d.notaMinimaAprovacao,
              casasDecimais: d.casasDecimais,
              permiteSubstitutiva: d.permiteSubstitutiva,
              notaSubstitutiva: d.notaSubstitutiva,
              permiteExameFinal: d.permiteExameFinal,
              notaMinimaExame: d.notaMinimaExame,
              mediaAprovacaoExame: d.mediaAprovacaoExame,
              notaExame: d.notaExame,
              avaliacoes: avaliacoesExport,
            };
          })
        );

        return {
          id: p.id,
          nome: p.nome,
          dataInicio: p.dataInicio,
          dataFim: p.dataFim,
          disciplinas: disciplinasExport,
        };
      })
    );

    await this.repo.appendAuditoria({
      usuarioId,
      tipo: "DADOS_EXPORTADOS",
      metadados: { totalPeriodos: periodos.length },
    });

    return {
      geradoEm: new Date().toISOString(),
      usuario: {
        nome: usuario.nome,
        email: usuario.email,
        termosVersao: usuario.termosVersao,
        criadoEm: usuario.criadoEm,
      },
      periodos: periodosExport,
    };
  }

  /** E09 — Exclusão definitiva LGPD em cascata (RF03 / CA03.2–CA03.3 / RN17) */
  async deleteMe(usuarioId: string, input: DeleteMeInput): Promise<void> {
    const usuario = await this.repo.findUsuarioById(usuarioId);
    if (!usuario) {
      throw new DomainError({
        status: 401,
        code: "NAO_AUTENTICADO",
        title: "Não autenticado",
        detail: "Usuário não encontrado.",
      });
    }

    const senhaOk = await this.crypto.verifyPassword(input.senha, usuario.senhaHash);
    if (!senhaOk) {
      throw new DomainError({
        status: 401,
        code: "CREDENCIAIS_INVALIDAS",
        title: "Senha incorreta",
        detail: "A senha informada está incorreta. A conta não foi excluída.",
      });
    }

    await this.repo.appendAuditoria({
      usuarioId: null,
      tipo: "CONTA_EXCLUIDA",
      metadados: { motivo: "SOLICITACAO_TITULAR_LGPD" },
    });

    await this.repo.deleteUsuarioCascade(usuarioId);
  }
}
