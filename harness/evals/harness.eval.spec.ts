import { describe, expect, it } from "vitest";
import {
  HarnessOrchestrator,
  PathGuard,
  PiiAndSecretScanner,
  type HarnessTaskContract,
  type MultiLlmProvider,
} from "../index.js";

function createBaseContract(
  overrides: Partial<HarnessTaskContract> = {}
): HarnessTaskContract {
  return {
    taskId: "T33",
    specVersion: "spec-v1.1.0",
    rfs: ["RF09", "RF10", "RF12", "RF15"],
    cas: ["CA09.1", "CA09.5", "CA09.6", "CA10.3", "CA12.1", "CA12.5"],
    riskLevel: "RISCO_A",
    pathsPermitidos: ["packages/domain/**"],
    contextText: "Implementar motor decimal @app/domain para fixture ana@example.test",
    ...overrides,
  };
}

describe("Evals do Harness EV01–EV04 (CT06, CT07, CT08 — docs/harness-spec.md §5)", () => {
  it("EV01 / CT06-6A: Interrompe exatamente após 3 ciclos falhos, grava checkpoint ESCALATED e não abre PR", async () => {
    const orchestrator = new HarnessOrchestrator();
    const provider: MultiLlmProvider = {
      async planWithM1() {
        return {
          roleUsed: "M1",
          modelId: "gpt-5",
          data: {
            filesToTouch: ["packages/domain/src/calculo.ts"],
            acceptanceCriteriaCovered: ["CA09.1"],
            steps: ["Implementar calculo"],
          },
          inputTokens: 5_000,
          outputTokens: 500,
        };
      },
      async executeWithM2(_p, cycle) {
        return {
          roleUsed: "M2",
          modelId: "claude-sonnet-4-5",
          data: {
            writes: [{ path: "packages/domain/src/calculo.ts", content: `// tentativa ${cycle}` }],
            summary: `Tentativa ${cycle}`,
          },
          inputTokens: 8_000,
          outputTokens: 1_000,
        };
      },
      async triageWithM3() {
        return {
          roleUsed: "M3",
          modelId: "gemini-2.5-flash",
          data: {
            rootCause: "Asserção impossível falhando",
            file: "packages/domain/src/calculo.ts",
            line: 1,
            suggestedFix: "Revisar spec",
          },
          inputTokens: 2_000,
          outputTokens: 200,
        };
      },
      async reviewWithM1() {
        throw new Error("Não deveria chamar Reviewer quando gates falham");
      },
    };

    const report = await orchestrator.runTask({
      contract: createBaseContract(),
      provider,
      humanApprovePlan: async () => true,
      runDeterministicGates: async () => ({
        passed: false,
        coveragePct: 40,
        errorLogs: "AssertionError: expected true to be false",
      }),
    });

    expect(report.status).toBe("ESCALATED");
    expect(report.escalationReason).toBe("MAX_CYCLES_EXCEEDED");
    expect(report.cyclesExecuted).toBe(3);
    expect(report.prOpened).toBe(false);
    expect(report.triageHistory).toHaveLength(2);
  });

  it("EV01 / CT06-6B: Timeout individual interrompe execução e escala sem abrir PR", async () => {
    const orchestrator = new HarnessOrchestrator();
    const provider: MultiLlmProvider = {
      async planWithM1() {
        return {
          roleUsed: "M1",
          modelId: "gpt-5",
          data: { filesToTouch: [], acceptanceCriteriaCovered: [], steps: [] },
          inputTokens: 1_000,
          outputTokens: 100,
        };
      },
      async executeWithM2() {
        await new Promise((r) => setTimeout(r, 120));
        return {
          roleUsed: "M2",
          modelId: "claude-sonnet-4-5",
          data: { writes: [], summary: "tarde demais" },
          inputTokens: 1_000,
          outputTokens: 100,
        };
      },
      async triageWithM3() {
        throw new Error("Não esperado");
      },
      async reviewWithM1() {
        throw new Error("Não esperado");
      },
    };

    const report = await orchestrator.runTask({
      contract: createBaseContract({ riskLevel: "BAIXO", callTimeoutMs: 30 }),
      provider,
      runDeterministicGates: async () => ({ passed: true, coveragePct: 100 }),
    });

    expect(report.status).toBe("ESCALATED");
    expect(report.escalationReason).toContain("TIMEOUT_EXCEEDED");
    expect(report.prOpened).toBe(false);
  });

  it("EV02 / CT07-7A: BudgetCircuitBreaker para antes de estourar US$ 0,10 e não abre PR", async () => {
    const orchestrator = new HarnessOrchestrator();
    const provider: MultiLlmProvider = {
      async planWithM1() {
        return {
          roleUsed: "M1",
          modelId: "gpt-5",
          data: { filesToTouch: ["packages/domain/src/x.ts"], acceptanceCriteriaCovered: [], steps: [] },
          inputTokens: 20_000,
          outputTokens: 2_000,
        };
      },
      async executeWithM2() {
        return {
          roleUsed: "M2",
          modelId: "claude-sonnet-4-5",
          data: {
            writes: [{ path: "packages/domain/src/x.ts", content: "export const x = 1;" }],
            summary: "exec",
          },
          inputTokens: 25_000,
          outputTokens: 2_000,
        };
      },
      async triageWithM3() {
        return {
          roleUsed: "M3",
          modelId: "gemini-2.5-flash",
          data: { rootCause: "erro", file: "x.ts", line: 1, suggestedFix: "fix" },
          inputTokens: 2_000,
          outputTokens: 200,
        };
      },
      async reviewWithM1() {
        return {
          roleUsed: "M1",
          modelId: "gpt-5",
          data: { approved: true, blockingIssues: [], notes: "ok" },
          inputTokens: 2_000,
          outputTokens: 200,
        };
      },
    };

    const report = await orchestrator.runTask({
      contract: createBaseContract({ riskLevel: "BAIXO", maxBudgetUsd: 0.1 }),
      provider,
      runDeterministicGates: async () => ({ passed: false, coveragePct: 0, errorLogs: "fail" }),
    });

    expect(report.status).toBe("ESCALATED");
    expect(report.escalationReason).toContain("Orçamento");
    expect(report.prOpened).toBe(false);
  });

  it("EV04 / CT07-7B & 7C: PathGuard bloqueia .github/workflows/ci.yml e PiiScanner bloqueia CPF e e-mail real", () => {
    const guard = new PathGuard(["packages/domain/**"]);
    expect(() => guard.assertWriteAllowed("packages/domain/src/calculo.ts")).not.toThrow();
    expect(() => guard.assertWriteAllowed(".github/workflows/ci.yml")).toThrow(/proibida/i);
    expect(() => guard.assertWriteAllowed("docs/constitution.md")).toThrow(/proibida/i);
    expect(() => guard.assertWriteAllowed("apps/web/src/page.tsx")).toThrow(/fora de paths_permitidos/i);

    const scanner = new PiiAndSecretScanner();
    expect(scanner.scan("Fixture sintético: ana@example.test")).toHaveLength(0);
    expect(scanner.scan("Aluno João CPF 123.456.789-00 e joao@faculdade.edu.br").length).toBeGreaterThanOrEqual(2);
    expect(() =>
      scanner.assertClean("Contato real: maria@faculdade.edu.br")
    ).toThrow(/PII ou segredo detectado/);
  });

  it("EV03 & CT08: Simulação ponta a ponta de T33 (falha no Ciclo 1 -> triagem M3 -> sucesso no Ciclo 2 -> PR rastreável)", async () => {
    const orchestrator = new HarnessOrchestrator();
    const provider: MultiLlmProvider = {
      async planWithM1() {
        return {
          roleUsed: "M1",
          modelId: "gpt-5",
          data: {
            filesToTouch: ["packages/domain/src/calculo.ts", "packages/domain/test/calculo.spec.ts"],
            acceptanceCriteriaCovered: ["CA09.1", "CA09.5", "CA09.6", "CA10.3", "CA12.1", "CA12.5"],
            steps: ["Usar decimal.js", "Implementar RN19 ganho ponderado", "Implementar RN20/21"],
          },
          inputTokens: 18_400,
          outputTokens: 2_100,
        };
      },
      async executeWithM2(_prompt, cycle) {
        return {
          roleUsed: "M2",
          modelId: "claude-sonnet-4-5",
          data: {
            writes: [
              {
                path: "packages/domain/src/calculo.ts",
                content:
                  cycle === 1
                    ? "// Ciclo 1: erro de arredondamento e menor nota nominal"
                    : "// Ciclo 2: Decimal.ROUND_HALF_UP e ganho ponderado RN19",
              },
            ],
            summary: `Ciclo ${cycle}`,
          },
          inputTokens: 20_000,
          outputTokens: 2_000,
        };
      },
      async triageWithM3() {
        return {
          roleUsed: "M3",
          modelId: "gemini-2.5-flash",
          data: {
            rootCause: "Uso de float binário e seleção nominal na substitutiva",
            file: "packages/domain/src/calculo.ts",
            line: 48,
            suggestedFix: "Usar Decimal.ROUND_HALF_UP e maximizar (notaSub - nota_i) * peso_i",
          },
          inputTokens: 4_800,
          outputTokens: 350,
        };
      },
      async reviewWithM1() {
        return {
          roleUsed: "M1",
          modelId: "gpt-5",
          data: {
            approved: true,
            blockingIssues: [],
            notes: "Todos os critérios CA09, CA10, CA12 e CA15 cobertos com 98.4% de cobertura.",
          },
          inputTokens: 12_000,
          outputTokens: 800,
        };
      },
    };

    const report = await orchestrator.runTask({
      contract: createBaseContract(),
      provider,
      humanApprovePlan: async () => true,
      runDeterministicGates: async (_writes, cycle) =>
        cycle === 1
          ? { passed: false, coveragePct: 88, errorLogs: "FAIL CA10.3 / RN19" }
          : { passed: true, coveragePct: 98.4 },
    });

    expect(report.status).toBe("PR_READY");
    expect(report.prOpened).toBe(true);
    expect(report.cyclesExecuted).toBe(2);
    expect(report.specVersion).toBe("spec-v1.1.0");
    expect(report.filesChanged).toEqual(["packages/domain/src/calculo.ts"]);
    expect(report.triageHistory).toHaveLength(1);
    expect(report.budget.spentUsd).toBeLessThan(8.0);
  });
});
