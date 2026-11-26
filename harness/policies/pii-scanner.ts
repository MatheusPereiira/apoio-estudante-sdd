import { PolicyViolationError } from "./path-guard.js";

export interface PiiFinding {
  kind: "CPF" | "EMAIL_REAL" | "SECRET";
  sample: string;
}

const CPF_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const EMAIL_REGEX = /\b[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
const SECRET_PATTERNS = [
  /\bsk-[a-zA-Z0-9_-]{20,}\b/g,
  /\bsk-ant-[a-zA-Z0-9_-]{20,}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}\b/g,
  /\bghp_[0-9A-Za-z]{30,}\b/g,
  /\bpostgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@[^\s]+/gi,
];

/**
 * Scanner determinístico de PII e Segredos (Constituição C4 / RN18 / RNF22 / EV04).
 * Permite apenas e-mails sintéticos no domínio `@example.test`.
 */
export class PiiAndSecretScanner {
  scan(content: string): PiiFinding[] {
    const findings: PiiFinding[] = [];

    for (const match of content.matchAll(CPF_REGEX)) {
      findings.push({ kind: "CPF", sample: "[CPF_DETECTADO]" });
      void match;
    }

    for (const match of content.matchAll(EMAIL_REGEX)) {
      const domain = (match[1] ?? "").toLowerCase();
      if (domain !== "example.test") {
        findings.push({ kind: "EMAIL_REAL", sample: `*@${domain}` });
      }
    }

    for (const re of SECRET_PATTERNS) {
      for (const match of content.matchAll(re)) {
        findings.push({ kind: "SECRET", sample: "[SECRET_DETECTADO]" });
        void match;
      }
    }

    return findings;
  }

  assertClean(content: string, contextLabel = "prompt"): void {
    const findings = this.scan(content);
    if (findings.length > 0) {
      const kinds = [...new Set(findings.map((f) => f.kind))].join(", ");
      throw new PolicyViolationError(
        `[C4] PII ou segredo detectado em ${contextLabel}: ${kinds}. Envio para LLM bloqueado.`
      );
    }
  }
}
