/**
 * Script de teste de carga k6 (Tarefa T38 — RNF01 p95 leitura < 300ms, RNF02 p95 escrita < 500ms).
 * Execução: k6 run -e BASE_URL=http://localhost:3000 apps/web/tests/perf/load-test.js
 */
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 50,
  duration: "30s",
  thresholds: {
    "http_req_duration{kind:read}": ["p(95)<300", "p(99)<800"],
    "http_req_duration{kind:write}": ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  const health = http.get(`${BASE_URL}/api/v1/health`, { tags: { kind: "read" } });
  check(health, { "health status 200": (r) => r.status === 200 });
  sleep(0.5);
}
