import pino from "pino";

/**
 * Logger estruturado JSON com redaction/scrubbing de PII (RNF12, RNF19, Constituição C4).
 */
export function maskPiiString(value: string): string {
  return value
    .replaceAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL_REDACTED]")
    .replaceAll(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF_REDACTED]");
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"),
  redact: {
    paths: [
      "email",
      "senha",
      "password",
      "token",
      "refreshToken",
      "authorization",
      "cookie",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },
  base: {
    service: "apoio-estudante-sdd",
    version: process.env.APP_VERSION ?? "1.1.0",
  },
});
