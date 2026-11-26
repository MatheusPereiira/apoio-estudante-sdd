/**
 * PathGuard (Constituição C5 / EV04 / CT07-7B):
 * Bloqueia qualquer escrita fora de `pathsPermitidos` da tarefa e proíbe sempre
 * escrita em `.env*`, `docs/constitution.md`, `.github/workflows/**` e `harness/policies/**`.
 */
const ALWAYS_FORBIDDEN_PATTERNS = [
  /^\.env(\..+)?$/i,
  /(^|\/)\.env(\..+)?$/i,
  /^docs\/constitution\.md$/i,
  /^\.github\/workflows\//i,
  /^harness\/policies\//i,
];

export class PolicyViolationError extends Error {
  readonly code = "POLICY_VIOLATION" as const;

  constructor(message: string) {
    super(message);
    this.name = "PolicyViolationError";
  }
}

function normalizePath(p: string): string {
  return p.replaceAll("\\", "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

function matchesGlobPrefix(filePath: string, pattern: string): boolean {
  const normFile = normalizePath(filePath);
  const normPattern = normalizePath(pattern);
  if (normPattern.endsWith("/**")) {
    const prefix = normPattern.slice(0, -3);
    return normFile === prefix || normFile.startsWith(`${prefix}/`);
  }
  return normFile === normPattern;
}

export class PathGuard {
  constructor(private readonly pathsPermitidos: string[]) {}

  assertWriteAllowed(targetPath: string): void {
    const norm = normalizePath(targetPath);

    if (norm.includes("..")) {
      throw new PolicyViolationError(`Path traversal proibido: "${targetPath}"`);
    }

    for (const forbidden of ALWAYS_FORBIDDEN_PATTERNS) {
      if (forbidden.test(norm)) {
        throw new PolicyViolationError(
          `Escrita estritamente proibida no arquivo protegido: "${norm}"`
        );
      }
    }

    const allowed = this.pathsPermitidos.some((p) => matchesGlobPrefix(norm, p));
    if (!allowed) {
      throw new PolicyViolationError(
        `Arquivo "${norm}" está fora de paths_permitidos (${this.pathsPermitidos.join(", ")}).`
      );
    }
  }
}
