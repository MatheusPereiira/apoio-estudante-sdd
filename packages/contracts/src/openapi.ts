/**
 * Gerador do documento OpenAPI 3.1 cobrindo todos os 35 endpoints (E01–E35)
 * definidos em docs/api-spec.md (spec-v1.1.0).
 */
export const ENDPOINTS_CATALOG = [
  { id: "E01", method: "get", path: "/api/v1/health", rf: "RNF04", auth: false },
  { id: "E02", method: "post", path: "/api/v1/auth/register", rf: "RF01", auth: false },
  { id: "E03", method: "post", path: "/api/v1/auth/login", rf: "RF02", auth: false },
  { id: "E04", method: "post", path: "/api/v1/auth/refresh", rf: "RF02", auth: true },
  { id: "E05", method: "post", path: "/api/v1/auth/logout", rf: "RF02", auth: true },
  { id: "E06", method: "get", path: "/api/v1/me", rf: "RF03", auth: true },
  { id: "E07", method: "patch", path: "/api/v1/me", rf: "RF03", auth: true },
  { id: "E08", method: "get", path: "/api/v1/me/export", rf: "RF03", auth: true },
  { id: "E09", method: "delete", path: "/api/v1/me", rf: "RF03", auth: true },
  { id: "E10", method: "get", path: "/api/v1/periodos", rf: "RF04", auth: true },
  { id: "E11", method: "post", path: "/api/v1/periodos", rf: "RF04", auth: true },
  { id: "E12", method: "get", path: "/api/v1/periodos/{periodoId}", rf: "RF04", auth: true },
  { id: "E13", method: "patch", path: "/api/v1/periodos/{periodoId}", rf: "RF04", auth: true },
  { id: "E14", method: "delete", path: "/api/v1/periodos/{periodoId}", rf: "RF04", auth: true },
  { id: "E15", method: "get", path: "/api/v1/periodos/{periodoId}/disciplinas", rf: "RF05", auth: true },
  { id: "E16", method: "post", path: "/api/v1/periodos/{periodoId}/disciplinas", rf: "RF05", auth: true },
  { id: "E17", method: "get", path: "/api/v1/disciplinas/{disciplinaId}", rf: "RF05,RF09", auth: true },
  { id: "E18", method: "patch", path: "/api/v1/disciplinas/{disciplinaId}", rf: "RF05,RF07", auth: true },
  { id: "E19", method: "delete", path: "/api/v1/disciplinas/{disciplinaId}", rf: "RF05", auth: true },
  { id: "E20", method: "post", path: "/api/v1/disciplinas/{disciplinaId}/avaliacoes", rf: "RF06", auth: true },
  { id: "E21", method: "patch", path: "/api/v1/avaliacoes/{avaliacaoId}", rf: "RF06,RF07", auth: true },
  { id: "E22", method: "delete", path: "/api/v1/avaliacoes/{avaliacaoId}", rf: "RF06", auth: true },
  { id: "E23", method: "put", path: "/api/v1/disciplinas/{disciplinaId}/avaliacoes/ordem", rf: "RF06", auth: true },
  { id: "E24", method: "put", path: "/api/v1/avaliacoes/{avaliacaoId}/nota", rf: "RF08", auth: true },
  { id: "E25", method: "delete", path: "/api/v1/avaliacoes/{avaliacaoId}/nota", rf: "RF08", auth: true },
  { id: "E26", method: "get", path: "/api/v1/avaliacoes/{avaliacaoId}/historico", rf: "RF11", auth: true },
  { id: "E27", method: "get", path: "/api/v1/disciplinas/{disciplinaId}/desempenho", rf: "RF09,RF10,RF15", auth: true },
  { id: "E28", method: "get", path: "/api/v1/disciplinas/{disciplinaId}/nota-necessaria", rf: "RF12", auth: true },
  { id: "E29", method: "post", path: "/api/v1/disciplinas/{disciplinaId}/simulacoes", rf: "RF13", auth: true },
  { id: "E30", method: "post", path: "/api/v1/disciplinas/{disciplinaId}/previa-criterios", rf: "RF07", auth: true },
  { id: "E31", method: "get", path: "/api/v1/periodos/{periodoId}/painel", rf: "RF14,RF15", auth: true },
  { id: "E32", method: "put", path: "/api/v1/disciplinas/{disciplinaId}/substitutiva", rf: "RF08,RN19", auth: true },
  { id: "E33", method: "delete", path: "/api/v1/disciplinas/{disciplinaId}/substitutiva", rf: "RF08,RN19", auth: true },
  { id: "E34", method: "put", path: "/api/v1/disciplinas/{disciplinaId}/exame-final", rf: "RF08,RN20,RN21", auth: true },
  { id: "E35", method: "delete", path: "/api/v1/disciplinas/{disciplinaId}/exame-final", rf: "RF08,RN20,RN21", auth: true },
] as const;

export function buildOpenApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const ep of ENDPOINTS_CATALOG) {
    paths[ep.path] ??= {};
    paths[ep.path]![ep.method] = {
      operationId: ep.id,
      summary: `${ep.id} (${ep.rf})`,
      security: ep.auth ? [{ cookieAuth: [], csrfToken: [] }] : [],
      responses: {
        "200": { description: "Sucesso" },
        "404": { description: "Recurso não encontrado ou de outro estudante (RN01)" },
      },
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Plataforma de Apoio ao Estudante Universitário API",
      version: "1.1.0",
      description: "Contrato OpenAPI 3.1 rastreável a docs/api-spec.md (spec-v1.1.0)",
    },
    paths,
    components: {
      securitySchemes: {
        cookieAuth: { type: "apiKey", in: "cookie", name: "access_token" },
        csrfToken: { type: "apiKey", in: "header", name: "X-CSRF-Token" },
      },
    },
  };
}
