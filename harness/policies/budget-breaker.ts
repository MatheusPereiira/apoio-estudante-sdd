import { HARNESS_LIMITS, MODEL_MATRIX, type ModelRole } from "./config.js";

export class BudgetExceededError extends Error {
  readonly code = "BUDGET_EXCEEDED" as const;

  constructor(message: string) {
    super(message);
    this.name = "BudgetExceededError";
  }
}

export interface TokenUsage {
  role: ModelRole;
  inputTokens: number;
  outputTokens: number;
}

/**
 * BudgetCircuitBreaker (Constituição C6 / EV02 / CT07-7A):
 * Controla tokens e custo acumulado por tarefa e semana, abortando antes de exceder o limite.
 */
export class BudgetCircuitBreaker {
  private inputTokens = 0;
  private outputTokens = 0;
  private spentUsd = 0;

  constructor(
    private readonly limits: {
      maxBudgetUsd?: number;
      maxInputTokens?: number;
      maxOutputTokens?: number;
    } = {}
  ) {}

  get maxBudgetUsd(): number {
    return this.limits.maxBudgetUsd ?? HARNESS_LIMITS.maxBudgetPerTaskUsd;
  }

  get maxInputTokens(): number {
    return this.limits.maxInputTokens ?? HARNESS_LIMITS.maxInputTokensPerTask;
  }

  get maxOutputTokens(): number {
    return this.limits.maxOutputTokens ?? HARNESS_LIMITS.maxOutputTokensPerTask;
  }

  estimateCostUsd(usage: TokenUsage): number {
    const spec = MODEL_MATRIX[usage.role];
    return (
      (usage.inputTokens / 1_000_000) * spec.inputPricePer1MUsd +
      (usage.outputTokens / 1_000_000) * spec.outputPricePer1MUsd
    );
  }

  assertCanProceed(estimatedNext?: TokenUsage): void {
    const projectedCost =
      this.spentUsd + (estimatedNext ? this.estimateCostUsd(estimatedNext) : 0);
    const projectedIn = this.inputTokens + (estimatedNext?.inputTokens ?? 0);
    const projectedOut = this.outputTokens + (estimatedNext?.outputTokens ?? 0);

    if (projectedCost > this.maxBudgetUsd) {
      throw new BudgetExceededError(
        `Orçamento da tarefa excedido: projetado US$ ${projectedCost.toFixed(4)} > teto US$ ${this.maxBudgetUsd.toFixed(2)}.`
      );
    }
    if (projectedIn > this.maxInputTokens) {
      throw new BudgetExceededError(
        `Limite de tokens de entrada excedido: ${projectedIn} > ${this.maxInputTokens}.`
      );
    }
    if (projectedOut > this.maxOutputTokens) {
      throw new BudgetExceededError(
        `Limite de tokens de saída excedido: ${projectedOut} > ${this.maxOutputTokens}.`
      );
    }
  }

  record(usage: TokenUsage): { spentUsd: number; alert80: boolean } {
    this.inputTokens += usage.inputTokens;
    this.outputTokens += usage.outputTokens;
    this.spentUsd += this.estimateCostUsd(usage);

    if (this.spentUsd > this.maxBudgetUsd) {
      throw new BudgetExceededError(
        `Orçamento da tarefa ultrapassado: US$ ${this.spentUsd.toFixed(4)} > US$ ${this.maxBudgetUsd.toFixed(2)}.`
      );
    }

    return {
      spentUsd: Number(this.spentUsd.toFixed(6)),
      alert80: this.spentUsd >= this.maxBudgetUsd * HARNESS_LIMITS.weeklyAlertThresholdPct,
    };
  }

  snapshot() {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      spentUsd: Number(this.spentUsd.toFixed(6)),
      maxBudgetUsd: this.maxBudgetUsd,
    };
  }
}
