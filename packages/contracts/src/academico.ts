import { z } from "zod";

function hasMaxTwoDecimals(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const scaled = Math.round(value * 100);
  return Math.abs(value * 100 - scaled) < 1e-7;
}

export const NotaSchema = z
  .number({ invalid_type_error: "Informe um número válido." })
  .min(0, "A nota deve estar entre 0 e 10.")
  .max(10, "A nota deve estar entre 0 e 10.")
  .refine(hasMaxTwoDecimals, "A nota deve ter no máximo 2 casas decimais.");

export const PesoSchema = z
  .number({ invalid_type_error: "Informe um peso válido." })
  .gt(0, "O peso deve ser maior que 0.")
  .max(100, "O peso deve ser no máximo 100.")
  .refine(hasMaxTwoDecimals, "O peso deve ter no máximo 2 casas decimais.");

export const DateIsoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD.");

export const MetodoCalculoSchema = z.enum(["SIMPLES", "PONDERADA"]);
export const CasasDecimaisSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);

// E11 / E13 — Períodos Letivos
export const CreatePeriodoSchema = z
  .object({
    nome: z.string().trim().min(1, "Nome é obrigatório.").max(40, "Máximo de 40 caracteres."),
    dataInicio: DateIsoSchema.nullable().optional(),
    dataFim: DateIsoSchema.nullable().optional(),
  })
  .refine(
    (d) => !d.dataInicio || !d.dataFim || d.dataFim >= d.dataInicio,
    { message: "A data de fim não pode ser anterior à data de início.", path: ["dataFim"] }
  );

export const UpdatePeriodoSchema = z
  .object({
    nome: z.string().trim().min(1).max(40).optional(),
    dataInicio: DateIsoSchema.nullable().optional(),
    dataFim: DateIsoSchema.nullable().optional(),
    versao: z.number().int().min(1),
  })
  .refine(
    (d) => !d.dataInicio || !d.dataFim || d.dataFim >= d.dataInicio,
    { message: "A data de fim não pode ser anterior à data de início.", path: ["dataFim"] }
  );

// E16 / E18 — Disciplinas
export const CreateDisciplinaSchema = z
  .object({
    nome: z.string().trim().min(1, "Nome é obrigatório.").max(120),
    codigo: z.string().trim().max(20).nullable().optional(),
    metodoCalculo: MetodoCalculoSchema.default("PONDERADA"),
    notaMinimaAprovacao: NotaSchema.default(6.0),
    casasDecimais: CasasDecimaisSchema.default(1),
    permiteSubstitutiva: z.boolean().default(true),
    permiteExameFinal: z.boolean().default(true),
    notaMinimaExame: NotaSchema.default(4.0),
    mediaAprovacaoExame: NotaSchema.default(5.0),
  })
  .refine((d) => d.notaMinimaExame <= d.notaMinimaAprovacao, {
    message: "A nota mínima para exame não pode exceder a nota mínima de aprovação.",
    path: ["notaMinimaExame"],
  });

export const UpdateDisciplinaSchema = z.object({
  nome: z.string().trim().min(1).max(120).optional(),
  codigo: z.string().trim().max(20).nullable().optional(),
  metodoCalculo: MetodoCalculoSchema.optional(),
  notaMinimaAprovacao: NotaSchema.optional(),
  casasDecimais: CasasDecimaisSchema.optional(),
  permiteSubstitutiva: z.boolean().optional(),
  permiteExameFinal: z.boolean().optional(),
  notaMinimaExame: NotaSchema.optional(),
  mediaAprovacaoExame: NotaSchema.optional(),
  versao: z.number().int().min(1),
  confirmar: z.boolean().optional(),
});

// E20 / E21 / E23 — Avaliações
export const CreateAvaliacaoSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório.").max(80),
  peso: PesoSchema.optional(),
  elegivelSubstitutiva: z.boolean().default(true),
  dataPrevista: DateIsoSchema.nullable().optional(),
});

export const UpdateAvaliacaoSchema = z.object({
  nome: z.string().trim().min(1).max(80).optional(),
  peso: PesoSchema.optional(),
  elegivelSubstitutiva: z.boolean().optional(),
  dataPrevista: DateIsoSchema.nullable().optional(),
  versao: z.number().int().min(1),
  confirmar: z.boolean().optional(),
});

export const ReordenarAvaliacoesSchema = z.object({
  ordem: z.array(z.string().uuid()).min(1),
});

// E24 / E32 / E34 — Lançamento de Notas
export const LancarNotaSchema = z.object({
  nota: NotaSchema,
  versao: z.number().int().min(1),
});

// E28 — Nota Necessária Query
export const NotaNecessariaQuerySchema = z.object({
  alvo: NotaSchema.optional(),
});

// E29 — Simulação "E se?"
export const SimulacaoSchema = z
  .object({
    notasHipoteticas: z
      .array(
        z.object({
          avaliacaoId: z.string().uuid(),
          nota: NotaSchema.nullable(),
        })
      )
      .max(20),
    notaSubstitutiva: NotaSchema.nullable().optional(),
    notaExame: NotaSchema.nullable().optional(),
  })
  .refine(
    (d) => {
      const ids = d.notasHipoteticas.map((i) => i.avaliacaoId);
      return new Set(ids).size === ids.length;
    },
    { message: "IDs de avaliações duplicados na simulação.", path: ["notasHipoteticas"] }
  );

// E30 — Prévia de Alteração de Critérios
export const PreviaCriteriosSchema = z.object({
  metodoCalculo: MetodoCalculoSchema.optional(),
  notaMinimaAprovacao: NotaSchema.optional(),
  casasDecimais: CasasDecimaisSchema.optional(),
  permiteSubstitutiva: z.boolean().optional(),
  permiteExameFinal: z.boolean().optional(),
  notaMinimaExame: NotaSchema.optional(),
  mediaAprovacaoExame: NotaSchema.optional(),
  pesos: z
    .array(
      z.object({
        avaliacaoId: z.string().uuid(),
        peso: PesoSchema,
      })
    )
    .optional(),
});

export type CreatePeriodoInput = z.infer<typeof CreatePeriodoSchema>;
export type UpdatePeriodoInput = z.infer<typeof UpdatePeriodoSchema>;
export type CreateDisciplinaInput = z.infer<typeof CreateDisciplinaSchema>;
export type UpdateDisciplinaInput = z.infer<typeof UpdateDisciplinaSchema>;
export type CreateAvaliacaoInput = z.infer<typeof CreateAvaliacaoSchema>;
export type UpdateAvaliacaoInput = z.infer<typeof UpdateAvaliacaoSchema>;
export type LancarNotaInput = z.infer<typeof LancarNotaSchema>;
export type SimulacaoInput = z.infer<typeof SimulacaoSchema>;
export type PreviaCriteriosInput = z.infer<typeof PreviaCriteriosSchema>;
