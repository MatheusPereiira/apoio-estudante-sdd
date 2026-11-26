import { z } from "zod";

export const TERMS_VERSION_ATUAL = process.env.TERMS_VERSION ?? "2026-11";

/**
 * Lista de senhas comuns bloqueadas (RF01 / CA01.3).
 */
export const SENHAS_COMUNS = new Set([
  "1234567890",
  "12345678901",
  "password123",
  "qwerty12345",
  "senha12345",
  "senha123456",
  "estudante123",
  "faculdade123",
  "abcdef1234",
  "admin12345",
  "0000000000",
]);

export const SenhaForteSchema = z
  .string()
  .min(10, "A senha deve ter no mínimo 10 caracteres.")
  .max(128, "A senha deve ter no máximo 128 caracteres.")
  .refine((v) => /[a-zA-Z]/.test(v), "A senha deve conter letras.")
  .refine((v) => /\d/.test(v), "A senha deve conter números.")
  .refine((v) => !SENHAS_COMUNS.has(v.toLowerCase()), "Esta senha é muito comum. Escolha outra.");

export const RegisterSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "O nome deve ter entre 2 e 120 caracteres.")
    .max(120, "O nome deve ter entre 2 e 120 caracteres."),
  email: z
    .string()
    .trim()
    .email("Informe um e-mail válido.")
    .max(254, "E-mail muito longo.")
    .transform((v) => v.toLowerCase()),
  senha: SenhaForteSchema,
  aceiteTermos: z.literal(true, {
    errorMap: () => ({ message: "É obrigatório aceitar os termos de uso e privacidade." }),
  }),
  termosVersao: z
    .string()
    .min(1)
    .max(20)
    .refine(
      (v) => v === TERMS_VERSION_ATUAL,
      `A versão dos termos deve ser ${TERMS_VERSION_ATUAL}.`
    ),
});

export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Informe um e-mail válido.")
    .transform((v) => v.toLowerCase()),
  senha: z.string().min(1, "Informe a senha."),
});

export const UpdateMeSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "O nome deve ter entre 2 e 120 caracteres.")
    .max(120, "O nome deve ter entre 2 e 120 caracteres."),
});

export const DeleteMeSchema = z.object({
  senha: z.string().min(1, "Informe sua senha para confirmar a exclusão."),
  confirmacao: z.literal("EXCLUIR MINHA CONTA", {
    errorMap: () => ({ message: 'Digite exatamente "EXCLUIR MINHA CONTA".' }),
  }),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UpdateMeInput = z.infer<typeof UpdateMeSchema>;
export type DeleteMeInput = z.infer<typeof DeleteMeSchema>;
