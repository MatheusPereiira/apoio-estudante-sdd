import { MODEL_MATRIX, type ModelRole, type RiskLevel } from "../policies/config.js";

export interface PlanOutput {
  filesToTouch: string[];
  acceptanceCriteriaCovered: string[];
  steps: string[];
}

export interface ExecutionOutput {
  writes: Array<{ path: string; content: string }>;
  summary: string;
}

export interface TriageOutput {
  rootCause: string;
  file: string;
  line: number;
  suggestedFix: string;
}

export interface ReviewOutput {
  approved: boolean;
  blockingIssues: string[];
  notes: string;
}

export interface ModelCallResult<T> {
  roleUsed: ModelRole;
  modelId: string;
  data: T;
  inputTokens: number;
  outputTokens: number;
}

export interface MultiLlmProvider {
  planWithM1(prompt: string): Promise<ModelCallResult<PlanOutput>>;
  executeWithM2(prompt: string, cycle: number): Promise<ModelCallResult<ExecutionOutput>>;
  executeFallbackWithM3?(prompt: string, cycle: number): Promise<ModelCallResult<ExecutionOutput>>;
  triageWithM3(errorLogs: string): Promise<ModelCallResult<TriageOutput>>;
  reviewWithM1(diffSummary: string): Promise<ModelCallResult<ReviewOutput>>;
}

/**
 * Roteador Multi-LLM (ADR-002):
 * M1 planeja/revisa (OpenAI), M2 executa (Anthropic), M3 tria/fallback (Google).
 * Regra: fallback M2 -> M3 só é permitido em tarefas de risco BAIXO.
 */
export function resolveExecutorRole(params: {
  riskLevel: RiskLevel;
  m2Unavailable: boolean;
}): { role: ModelRole; modelId: string } | null {
  if (!params.m2Unavailable) {
    return { role: "M2", modelId: MODEL_MATRIX.M2.modelId };
  }
  if (params.riskLevel === "BAIXO") {
    return { role: "M3", modelId: MODEL_MATRIX.M3.modelId };
  }
  // Risco Médio ou Risco A: nunca faz fallback — interrompe e escala!
  return null;
}
