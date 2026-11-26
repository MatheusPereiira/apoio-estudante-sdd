import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { DomainError } from "@app/contracts";
import {
  getAppContainer,
  logger,
  verifyCsrfDoubleSubmit,
  type AppContainer,
  type RateLimitResult,
} from "@app/infrastructure";

const IS_PROD = process.env.NODE_ENV === "production";

export function newTraceId(): string {
  return randomUUID().replaceAll("-", "").toUpperCase();
}

export function attachAuthCookies(
  res: NextResponse,
  tokens: { accessToken: string; refreshToken: string; csrfToken: string }
): NextResponse {
  res.cookies.set("access_token", tokens.accessToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });
  res.cookies.set("refresh_token", tokens.refreshToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/api/v1/auth",
    maxAge: 7 * 24 * 60 * 60,
  });
  res.cookies.set("csrf_token", tokens.csrfToken, {
    httpOnly: false,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}

export function clearAuthCookies(res: NextResponse): NextResponse {
  res.cookies.set("access_token", "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set("refresh_token", "", { httpOnly: true, path: "/api/v1/auth", maxAge: 0 });
  res.cookies.set("csrf_token", "", { httpOnly: false, path: "/", maxAge: 0 });
  return res;
}

export function applyStandardHeaders(
  res: NextResponse,
  traceId: string,
  rateLimit?: RateLimitResult
): NextResponse {
  res.headers.set("X-Trace-Id", traceId);
  if (rateLimit) {
    res.headers.set("RateLimit-Limit", String(rateLimit.limit));
    res.headers.set("RateLimit-Remaining", String(rateLimit.remaining));
    res.headers.set("RateLimit-Reset", String(rateLimit.resetEpochSec));
  }
  return res;
}

export async function parseJsonBody<S extends ZodTypeAny>(
  req: NextRequest,
  schema: S
): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new DomainError({
      status: 400,
      code: "REQUISICAO_MALFORMADA",
      title: "Requisição malformada",
      detail: "O corpo da requisição deve ser um JSON válido.",
    });
  }
  return schema.parse(raw);
}

export async function requireAuth(
  req: NextRequest,
  container: AppContainer,
  options: { checkCsrf?: boolean } = {}
): Promise<{ usuarioId: string; email: string; rateLimit: RateLimitResult }> {
  const accessToken = req.cookies.get("access_token")?.value;
  if (!accessToken) {
    throw new DomainError({
      status: 401,
      code: "NAO_AUTENTICADO",
      title: "Não autenticado",
      detail: "Faça login para acessar este recurso.",
    });
  }

  const payload = await container.crypto.verifyAccessToken(accessToken);
  if (!payload) {
    throw new DomainError({
      status: 401,
      code: "NAO_AUTENTICADO",
      title: "Sessão expirada",
      detail: "Token de acesso inválido ou expirado.",
    });
  }

  if (options.checkCsrf !== false) {
    verifyCsrfDoubleSubmit({
      method: req.method,
      cookieToken: req.cookies.get("csrf_token")?.value,
      headerToken: req.headers.get("x-csrf-token"),
    });
  }

  // RNF10: 120 req/min por usuário
  const rateLimit = container.rateLimiter.enforce(`api:${payload.sub}`, 120, 60_000);
  return { usuarioId: payload.sub, email: payload.email, rateLimit };
}

export function handleApiError(err: unknown, traceId: string): NextResponse {
  if (err instanceof DomainError) {
    const body = err.toProblemDetails(traceId);
    const res = NextResponse.json(body, {
      status: err.status,
      headers: { "Content-Type": "application/problem+json; charset=utf-8" },
    });
    if (err.status === 429 && typeof err.extra?.retryAfter === "number") {
      res.headers.set("Retry-After", String(err.extra.retryAfter));
    }
    return applyStandardHeaders(res, traceId);
  }

  if (err instanceof ZodError) {
    const errors = err.issues.map((issue) => ({
      field: issue.path.join(".") || "body",
      code: issue.code.toUpperCase(),
      message: issue.message,
    }));
    const dErr = new DomainError({
      status: 422,
      code: "VALIDACAO",
      title: "Dados inválidos",
      detail: errors[0]?.message ?? "Um ou mais campos são inválidos.",
      errors,
    });
    const res = NextResponse.json(dErr.toProblemDetails(traceId), {
      status: 422,
      headers: { "Content-Type": "application/problem+json; charset=utf-8" },
    });
    return applyStandardHeaders(res, traceId);
  }

  logger.error({ traceId, err: err instanceof Error ? err.message : "unknown" }, "api_internal_error");
  const fallback = new DomainError({
    status: 500,
    code: "ERRO_INTERNO",
    title: "Erro interno",
    detail: "Ocorreu um erro inesperado. Tente novamente em instantes.",
  });
  const res = NextResponse.json(fallback.toProblemDetails(traceId), {
    status: 500,
    headers: { "Content-Type": "application/problem+json; charset=utf-8" },
  });
  return applyStandardHeaders(res, traceId);
}

export async function withApiHandler(
  handler: (container: AppContainer, traceId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  const traceId = newTraceId();
  try {
    const container = await getAppContainer();
    const res = await handler(container, traceId);
    res.headers.set("X-Trace-Id", traceId);
    return res;
  } catch (err) {
    return handleApiError(err, traceId);
  }
}

export function getClientIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}
