import { timingSafeEqual } from "node:crypto";
import { DomainError } from "@app/contracts";

/**
 * Proteção CSRF Double-Submit Cookie (RNF08 / CT05).
 */
export function verifyCsrfDoubleSubmit(params: {
  method: string;
  cookieToken: string | null | undefined;
  headerToken: string | null | undefined;
}): void {
  const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
  if (safeMethods.has(params.method.toUpperCase())) {
    return;
  }

  const cookie = params.cookieToken?.trim() ?? "";
  const header = params.headerToken?.trim() ?? "";

  if (!cookie || !header || cookie.length !== header.length) {
    throw new DomainError({
      status: 403,
      code: "CSRF_INVALIDO",
      title: "Token CSRF inválido",
      detail: "Cabeçalho X-CSRF-Token ausente ou divergente do cookie csrf_token.",
    });
  }

  const a = Buffer.from(cookie);
  const b = Buffer.from(header);
  if (!timingSafeEqual(a, b)) {
    throw new DomainError({
      status: 403,
      code: "CSRF_INVALIDO",
      title: "Token CSRF inválido",
      detail: "Cabeçalho X-CSRF-Token divergente do cookie csrf_token.",
    });
  }
}
