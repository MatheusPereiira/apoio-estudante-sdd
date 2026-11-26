export type ErrorCode =
  | "REQUISICAO_MALFORMADA"
  | "NAO_AUTENTICADO"
  | "CREDENCIAIS_INVALIDAS"
  | "CSRF_INVALIDO"
  | "NAO_ENCONTRADO"
  | "NOME_DUPLICADO"
  | "CONFLITO_VERSAO"
  | "CONFIRMACAO_NECESSARIA"
  | "VALIDACAO"
  | "SOMA_PESOS_EXCEDIDA"
  | "LIMITE_ATINGIDO"
  | "CADASTRO_INVALIDO"
  | "CONTA_BLOQUEADA"
  | "LIMITE_REQUISICOES"
  | "NOTA_INEXISTENTE"
  | "SUBSTITUTIVA_DESABILITADA"
  | "AVALIACOES_REGULARES_PENDENTES"
  | "EXAME_NAO_ELEGIVEL"
  | "ERRO_INTERNO"
  | "INDISPONIVEL";

export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: ErrorCode;
  detail: string;
  errors?: FieldError[];
  traceId?: string;
  [extra: string]: unknown;
}

export class DomainError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly title: string;
  readonly errors?: FieldError[];
  readonly extra?: Record<string, unknown>;

  constructor(params: {
    status: number;
    code: ErrorCode;
    title: string;
    detail: string;
    errors?: FieldError[];
    extra?: Record<string, unknown>;
  }) {
    super(params.detail);
    this.name = "DomainError";
    this.status = params.status;
    this.code = params.code;
    this.title = params.title;
    this.errors = params.errors;
    this.extra = params.extra;
  }

  toProblemDetails(traceId: string, host = "https://apoio-estudante.local"): ProblemDetails {
    const slug = this.code.toLowerCase().replaceAll("_", "-");
    return {
      type: `${host}/errors/${slug}`,
      title: this.title,
      status: this.status,
      code: this.code,
      detail: this.message,
      ...(this.errors ? { errors: this.errors } : {}),
      ...(this.extra ?? {}),
      traceId,
    };
  }
}

export function notFoundError(detail = "Recurso não encontrado."): DomainError {
  return new DomainError({
    status: 404,
    code: "NAO_ENCONTRADO",
    title: "Não encontrado",
    detail,
  });
}

export function versionConflictError(): DomainError {
  return new DomainError({
    status: 409,
    code: "CONFLITO_VERSAO",
    title: "Conflito de versão",
    detail: "Este recurso foi alterado recentemente. Recarregue os dados e tente novamente.",
  });
}

export function duplicateNameError(entidade: string): DomainError {
  return new DomainError({
    status: 409,
    code: "NOME_DUPLICADO",
    title: "Nome duplicado",
    detail: `Já existe ${entidade} com este nome.`,
  });
}
