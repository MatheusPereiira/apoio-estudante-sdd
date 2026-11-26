export interface ApiErrorPayload {
  status: number;
  code?: string;
  title?: string;
  detail?: string;
  errors?: Array<{ field: string; code: string; message: string }>;
  [extra: string]: unknown;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly payload: ApiErrorPayload;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.detail ?? payload.title ?? `Erro HTTP ${status}`);
    this.status = status;
    this.payload = payload;
  }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

/**
 * Cliente HTTP com envio automático de X-CSRF-Token e renovação transparente de sessão (CA02.3).
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  retryAfterRefresh = true
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = getCookie("csrf_token");
    if (csrf) {
      headers.set("X-CSRF-Token", csrf);
    }
  }

  const res = await fetch(path, {
    ...init,
    method,
    headers,
    credentials: "include",
  });

  if (
    res.status === 401 &&
    retryAfterRefresh &&
    !path.includes("/api/v1/auth/")
  ) {
    const refreshRes = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (refreshRes.ok) {
      return apiFetch<T>(path, init, false);
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      typeof data === "object" && data !== null
        ? (data as ApiErrorPayload)
        : { status: res.status, detail: String(data) }
    );
  }

  return data as T;
}
