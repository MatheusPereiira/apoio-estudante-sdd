import { BudgetCircuitBreaker, BudgetExceededError } from "../policies/budget-breaker.js";
import { HARNESS_LIMITS, type RiskLevel } from "../policies/config.js";
import { PathGuard, PolicyViolationError } from "../policies/path-guard.js";
import { PiiAndSecretScanner } from "../policies/pii-scanner.js";
import {
  resolveExecutorRole,
  type MultiLlmProvider,
  type PlanOutput,
  type TriageOutput,
} from "./router.js";

export interface HarnessTaskContract {
  taskId: string;
  specVersion: string;
  rfs: string[];
  cas: string[];
  riskLevel: RiskLevel;
  pathsPermitidos: string[];
  contextText: string;
  maxBudgetUsd?: number;
  callTimeoutMs?: number;
  maxCycles?: number;
}

export interface DeterministicGateResult {
  passed: boolean;
  coveragePct: number;
  errorLogs?: string;
}

export interface HarnessRunReport {
  taskId: string;
  specVersion: string;
  rfs: string[];
  status: "PR_READY" | "ESCALATED" | "POLICY_VIOLATION" | "REJECTED_BY_HUMAN";
  escalationReason?: string;
  cyclesExecuted: number;
  checkpoints: string[];
  filesChanged: string[];
  plan?: PlanOutput;
  triageHistory: TriageOutput[];
  budget: ReturnType<BudgetCircuitBreaker["snapshot"]>;
  prOpened: boolean;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`TIMEOUT_EXCEEDED (${timeoutMs}ms)`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Orquestrador Determinístico do Harness (docs/harness-spec.md §1–§4).
 * Intercala chamadas M1/M2/M3 com PiiScanner, PathGuard, BudgetCircuitBreaker,
 * aprovação humana (Risco A) e gates determinísticos com no máximo 3 ciclos.
 */
export class HarnessOrchestrator {
  private readonly piiScanner = new PiiAndSecretScanner();

  async runTask(params: {
    contract: HarnessTaskContract;
    provider: MultiLlmProvider;
    runDeterministicGates: (
      writes: Array<{ path: string; content: string }>,
      cycle: number
    ) => Promise<DeterministicGateResult>;
    humanApprovePlan?: (plan: PlanOutput) => Promise<boolean>;
    m2Unavailable?: boolean;
  }): Promise<HarnessRunReport> {
    const { contract, provider, runDeterministicGates, humanApprovePlan } = params;
    const pathGuard = new PathGuard(contract.pathsPermitidos);
    const budget = new BudgetCircuitBreaker({ maxBudgetUsd: contract.maxBudgetUsd });
    const callTimeoutMs = contract.callTimeoutMs ?? HARNESS_LIMITS.callTimeoutMs;
    const maxCycles = contract.maxCycles ?? HARNESS_LIMITS.maxCycles;

    const checkpoints: string[] = [];
    const triageHistory: TriageOutput[] = [];
    let filesChanged: string[] = [];
    let cyclesExecuted = 0;

    try {
      // 1. ContextBuilder + PiiScanIn (C4 / EV04)
      checkpoints.push("ContextBuilder");
      this.piiScanner.assertClean(contract.contextText, `contexto:${contract.taskId}`);
      checkpoints.push("PiiScanIn:OK");

      // 2. Planner (M1)
      budget.assertCanProceed({ role: "M1", inputTokens: 15_000, outputTokens: 2_000 });
      const planRes = await withTimeout(
        provider.planWithM1(contract.contextText),
        callTimeoutMs
      );
      budget.record({
        role: "M1",
        inputTokens: planRes.inputTokens,
        outputTokens: planRes.outputTokens,
      });
      checkpoints.push("Planner_M1");

      // 3. HumanGatePlan (obrigatório em Risco A — C5)
      if (contract.riskLevel === "RISCO_A") {
        const approved = humanApprovePlan ? await humanApprovePlan(planRes.data) : false;
        checkpoints.push(`HumanGatePlan:${approved ? "APPROVED" : "REJECTED"}`);
        if (!approved) {
          return {
            taskId: contract.taskId,
            specVersion: contract.specVersion,
            rfs: contract.rfs,
            status: "REJECTED_BY_HUMAN",
            cyclesExecuted: 0,
            checkpoints,
            filesChanged: [],
            plan: planRes.data,
            triageHistory,
            budget: budget.snapshot(),
            prOpened: false,
          };
        }
      }

      // 4. Loop Executor (M2 / fallback M3) -> PathGuard -> DeterministicGates -> Triage (M3)
      const resolvedExec = resolveExecutorRole({
        riskLevel: contract.riskLevel,
        m2Unavailable: params.m2Unavailable ?? false,
      });
      if (!resolvedExec) {
        return {
          taskId: contract.taskId,
          specVersion: contract.specVersion,
          rfs: contract.rfs,
          status: "ESCALATED",
          escalationReason: "M2_UNAVAILABLE_HIGH_RISK",
          cyclesExecuted: 0,
          checkpoints,
          filesChanged: [],
          plan: planRes.data,
          triageHistory,
          budget: budget.snapshot(),
          prOpened: false,
        };
      }

      let lastTriage: TriageOutput | null = null;
      let gatesPassed = false;

      for (let cycle = 1; cycle <= maxCycles; cycle++) {
        cyclesExecuted = cycle;
        budget.assertCanProceed({ role: resolvedExec.role, inputTokens: 10_000, outputTokens: 1_500 });

        const execPrompt = lastTriage
          ? `${contract.contextText}\nTriagem anterior: ${JSON.stringify(lastTriage)}`
          : contract.contextText;
        this.piiScanner.assertClean(execPrompt, `exec_prompt:${contract.taskId}:c${cycle}`);

        const execRes = await withTimeout(
          resolvedExec.role === "M3" && provider.executeFallbackWithM3
            ? provider.executeFallbackWithM3(execPrompt, cycle)
            : provider.executeWithM2(execPrompt, cycle),
          callTimeoutMs
        );
        budget.record({
          role: execRes.roleUsed,
          inputTokens: execRes.inputTokens,
          outputTokens: execRes.outputTokens,
        });
        checkpoints.push(`Executor_${execRes.roleUsed}:c${cycle}`);

        // PathGuard determinístico em 100% dos arquivos gravados (EV04)
        for (const w of execRes.data.writes) {
          pathGuard.assertWriteAllowed(w.path);
          this.piiScanner.assertClean(w.content, `diff:${w.path}`);
        }
        filesChanged = execRes.data.writes.map((w) => w.path);

        const gateRes = await runDeterministicGates(execRes.data.writes, cycle);
        checkpoints.push(`DeterministicGates:c${cycle}:${gateRes.passed ? "PASS" : "FAIL"}`);

        if (gateRes.passed) {
          gatesPassed = true;
          break;
        }

        if (cycle < maxCycles) {
          budget.assertCanProceed({ role: "M3", inputTokens: 3_000, outputTokens: 500 });
          const triageRes = await withTimeout(
            provider.triageWithM3(gateRes.errorLogs ?? "Falha nos testes."),
            callTimeoutMs
          );
          budget.record({
            role: "M3",
            inputTokens: triageRes.inputTokens,
            outputTokens: triageRes.outputTokens,
          });
          lastTriage = triageRes.data;
          triageHistory.push(triageRes.data);
          checkpoints.push(`Triage_M3:c${cycle}`);
        }
      }

      if (!gatesPassed) {
        return {
          taskId: contract.taskId,
          specVersion: contract.specVersion,
          rfs: contract.rfs,
          status: "ESCALATED",
          escalationReason: "MAX_CYCLES_EXCEEDED",
          cyclesExecuted,
          checkpoints,
          filesChanged,
          plan: planRes.data,
          triageHistory,
          budget: budget.snapshot(),
          prOpened: false,
        };
      }

      // 5. Revisão Semântica (M1 — provedor diferente de M2)
      budget.assertCanProceed({ role: "M1", inputTokens: 10_000, outputTokens: 1_500 });
      const reviewRes = await withTimeout(
        provider.reviewWithM1(`Arquivos: ${filesChanged.join(", ")}`),
        callTimeoutMs
      );
      budget.record({
        role: "M1",
        inputTokens: reviewRes.inputTokens,
        outputTokens: reviewRes.outputTokens,
      });
      checkpoints.push(`Reviewer_M1:${reviewRes.data.approved ? "APPROVED" : "BLOCKED"}`);

      if (!reviewRes.data.approved) {
        return {
          taskId: contract.taskId,
          specVersion: contract.specVersion,
          rfs: contract.rfs,
          status: "ESCALATED",
          escalationReason: `REVIEW_BLOCKED: ${reviewRes.data.blockingIssues.join("; ")}`,
          cyclesExecuted,
          checkpoints,
          filesChanged,
          plan: planRes.data,
          triageHistory,
          budget: budget.snapshot(),
          prOpened: false,
        };
      }

      checkpoints.push("OpenPR");
      return {
        taskId: contract.taskId,
        specVersion: contract.specVersion,
        rfs: contract.rfs,
        status: "PR_READY",
        cyclesExecuted,
        checkpoints,
        filesChanged,
        plan: planRes.data,
        triageHistory,
        budget: budget.snapshot(),
        prOpened: true,
      };
    } catch (err) {
      if (err instanceof PolicyViolationError) {
        checkpoints.push("POLICY_VIOLATION");
        return {
          taskId: contract.taskId,
          specVersion: contract.specVersion,
          rfs: contract.rfs,
          status: "POLICY_VIOLATION",
          escalationReason: err.message,
          cyclesExecuted,
          checkpoints,
          filesChanged,
          triageHistory,
          budget: budget.snapshot(),
          prOpened: false,
        };
      }
      if (err instanceof BudgetExceededError) {
        checkpoints.push("BUDGET_CIRCUIT_BREAKER");
        return {
          taskId: contract.taskId,
          specVersion: contract.specVersion,
          rfs: contract.rfs,
          status: "ESCALATED",
          escalationReason: err.message,
          cyclesExecuted,
          checkpoints,
          filesChanged,
          triageHistory,
          budget: budget.snapshot(),
          prOpened: false,
        };
      }
      checkpoints.push("ESCALATED_ERROR");
      return {
        taskId: contract.taskId,
        specVersion: contract.specVersion,
        rfs: contract.rfs,
        status: "ESCALATED",
        escalationReason: err instanceof Error ? err.message : String(err),
        cyclesExecuted,
        checkpoints,
        filesChanged,
        triageHistory,
        budget: budget.snapshot(),
        prOpened: false,
      };
    }
  }
}
