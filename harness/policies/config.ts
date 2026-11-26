export type ModelRole = "M1" | "M2" | "M3";
export type RiskLevel = "BAIXO" | "MEDIO" | "RISCO_A";

export interface ModelSpec {
  role: ModelRole;
  provider: "openai" | "anthropic" | "google";
  modelId: string;
  inputPricePer1MUsd: number;
  outputPricePer1MUsd: number;
  maxInputTokensPerCall: number;
  maxOutputTokensPerCall: number;
  toolsAllowed: readonly string[];
}

/**
 * Política Multi-LLM (ADR-002 / docs/harness-spec.md §3).
 */
export const MODEL_MATRIX: Record<ModelRole, ModelSpec> = {
  M1: {
    role: "M1",
    provider: "openai",
    modelId: "gpt-5",
    inputPricePer1MUsd: 1.25,
    outputPricePer1MUsd: 10.0,
    maxInputTokensPerCall: 60_000,
    maxOutputTokensPerCall: 6_000,
    toolsAllowed: ["read_spec", "read_file", "search_code", "read_diff", "read_test_report"],
  },
  M2: {
    role: "M2",
    provider: "anthropic",
    modelId: "claude-sonnet-4-5",
    inputPricePer1MUsd: 3.0,
    outputPricePer1MUsd: 15.0,
    maxInputTokensPerCall: 25_000,
    maxOutputTokensPerCall: 2_000,
    toolsAllowed: [
      "read_file",
      "search_code",
      "write_file",
      "run_lint",
      "run_typecheck",
      "run_tests",
    ],
  },
  M3: {
    role: "M3",
    provider: "google",
    modelId: "gemini-2.5-flash",
    inputPricePer1MUsd: 0.3,
    outputPricePer1MUsd: 2.5,
    maxInputTokensPerCall: 10_000,
    maxOutputTokensPerCall: 1_000,
    toolsAllowed: ["read_logs", "read_test_report"],
  },
};

/**
 * Limites inegociáveis da Constituição C6 / RNF23.
 */
export const HARNESS_LIMITS = {
  maxCycles: 3,
  callTimeoutMs: 10 * 60 * 1000,
  testTimeoutMs: 5 * 60 * 1000,
  taskTimeoutMs: 30 * 60 * 1000,
  maxInputTokensPerTask: 1_500_000,
  maxOutputTokensPerTask: 120_000,
  maxBudgetPerTaskUsd: 8.0,
  maxWeeklyBudgetUsd: 90.0,
  weeklyAlertThresholdPct: 0.8,
  maxParallelTasks: 2,
} as const;
